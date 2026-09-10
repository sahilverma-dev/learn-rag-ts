import path from "path";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import cliProgress from "cli-progress";
import { pc } from "./db/pinecone";
import { loadPdfChunks, sanitizeMetadata } from "./db/ingest-utils";

async function loadLocalPDF() {
  const pdfPath = path.join(import.meta.dir, "data/BNS.pdf");
  const splitDocs = await loadPdfChunks(pdfPath);
  console.log(`Created ${splitDocs.length} chunks.`);

  return splitDocs;
}

async function embedDocsWithRetry(
  embeddings: GoogleGenerativeAIEmbeddings,
  texts: string[],
): Promise<number[][]> {
  // 1. Try batch embedding
  try {
    const res = await embeddings.embedDocuments(texts);
    if (
      res.length === texts.length &&
      res.every((v) => v && v.length === 3072)
    ) {
      return res;
    }
  } catch (e) {
    console.warn(
      "Batch embedding failed, falling back to item-by-item embedding...",
    );
  }

  // 2. Fallback to item-by-item embedding with backoff
  const results: number[][] = [];
  for (const text of texts) {
    let vec: number[] | null = null;
    let lastError: any = null;
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        const v = await embeddings.embedQuery(text);
        if (v && v.length === 3072) {
          vec = v;
          break;
        }
      } catch (e: any) {
        lastError = e;
        // Check for 429 / Rate Limit error to apply custom wait time if specified
        const waitMs =
          e?.status === 429 || e?.message?.includes("429")
            ? 15000 // Wait 15s for Gemini free tier RPM reset
            : 1000 * Math.pow(2, attempt);
        console.warn(
          `[Attempt ${attempt}/5] Embedding rate limited or failed. Waiting ${Math.round(waitMs / 1000)}s...`,
        );
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
    }
    if (!vec) {
      console.error(
        "Failed to generate embedding for text chunk:",
        text.slice(0, 100),
      );
      throw (
        lastError ||
        new Error(
          "Failed to generate embedding vector (dimension mismatch or API error).",
        )
      );
    }
    results.push(vec);
  }
  return results;
}

async function indexPdfToPinecone() {
  const INDEX_NAME = "pdf-embedded-index";

  // Check if index exists with matching dimension, recreate if mismatch
  const indexList = await pc.listIndexes();
  const existingIdx = indexList.indexes?.find((idx) => idx.name === INDEX_NAME);

  if (existingIdx && existingIdx.dimension !== 3072) {
    console.log(
      `Deleting existing index "${INDEX_NAME}" with dimension ${existingIdx.dimension}...`,
    );
    await pc.deleteIndex(INDEX_NAME);
    // Give local Pinecone emulator a moment to clean up
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  const updatedList = await pc.listIndexes();
  const exists = updatedList.indexes?.some((idx) => idx.name === INDEX_NAME);

  if (!exists) {
    console.log(`Creating index "${INDEX_NAME}" with 3072 dimensions...`);
    await pc.createIndex({
      name: INDEX_NAME,
      dimension: 3072, // Dimension for Google Gemini gemini-embedding-001
      metric: "cosine",
      spec: {
        serverless: {
          cloud: "aws",
          region: "us-east-1",
        },
      },
      waitUntilReady: true,
    });
  }

  // Get index details to resolve host port for local emulator
  const indexDescription = await pc.describeIndex(INDEX_NAME);
  const hostPort = indexDescription.host.split(":")[1];
  const hostUrl = `http://jarvis:${hostPort}`;

  const pineconeIndex = pc.index({
    name: INDEX_NAME,
    host: hostUrl,
  });

  const splitDocs = await loadLocalPDF();

  // 4. Initialize Google Gemini embedding model (gemini-embedding-2)
  console.log("Loading Google Gemini embedding model (gemini-embedding-2)...");
  const embeddings = new GoogleGenerativeAIEmbeddings({
    model: "gemini-embedding-2",
    apiKey: process.env.GOOGLE_API_KEY,
  });

  // 5. Generate embeddings and store in Pinecone with progress bar
  console.log(
    `Embedding and upserting ${splitDocs.length} chunks to Pinecone...`,
  );

  const progressBar = new cliProgress.SingleBar({
    format:
      "Embedding & Upserting |{bar}| {percentage}% | {value}/{total} Chunks | ETA: {eta}s",
    barCompleteChar: "\u2588",
    barIncompleteChar: "\u2591",
    hideCursor: true,
  });

  progressBar.start(splitDocs.length, 0);

  const namespace = pineconeIndex.namespace("pdf-documents");
  const BATCH_SIZE = 15;

  for (let i = 0; i < splitDocs.length; i += BATCH_SIZE) {
    const batchDocs = splitDocs.slice(i, i + BATCH_SIZE);
    const texts = batchDocs.map((doc) => doc.pageContent);

    // Embed batch documents with robust retry & fallback
    const vectors = await embedDocsWithRetry(embeddings, texts);

    // Format records for Pinecone SDK v8
    const records = batchDocs
      .map((doc, idx) => ({
        id: `doc-${i + idx}`,
        values: vectors[idx],
        metadata: sanitizeMetadata({
          text: doc.pageContent,
          ...doc.metadata,
        }),
      }))
      .filter((rec) => rec.values && rec.values.length === 3072);

    if (records.length > 0) {
      // Upsert records to Pinecone with retry for socket resets / emulator drops
      let upsertSuccess = false;
      let lastUpsertErr: any = null;
      for (let attempt = 1; attempt <= 5; attempt++) {
        try {
          await namespace.upsert({ records });
          upsertSuccess = true;
          break;
        } catch (err) {
          lastUpsertErr = err;
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        }
      }
      if (!upsertSuccess) {
        progressBar.stop();
        throw (
          lastUpsertErr || new Error("Pinecone upsert failed after retries.")
        );
      }
    }

    progressBar.update(Math.min(i + BATCH_SIZE, splitDocs.length));
    // Pause to respect Gemini free tier rate limits (100 RPM / limit per minute)
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  progressBar.stop();
  console.log("\nUpsert completed successfully.");

  // 6. Verify stored records in Pinecone
  const stats = await pineconeIndex.describeIndexStats();
  const pdfNamespaceCount =
    stats.namespaces?.["pdf-documents"]?.recordCount ?? 0;

  console.log("\n--- Index Verification ---");
  console.log(`Chunks created from PDF: ${splitDocs.length}`);
  console.log(`Vectors in Pinecone ("pdf-documents"): ${pdfNamespaceCount}`);

  if (pdfNamespaceCount === splitDocs.length) {
    console.log(
      "✅ Verification successful! 100% of PDF chunks are stored in Pinecone.",
    );
  } else {
    console.warn(
      `⚠️ Mismatch detected: Expected ${splitDocs.length} vectors, but found ${pdfNamespaceCount} in Pinecone.`,
    );
  }
}

indexPdfToPinecone().catch((err) => {
  console.error("\n❌ Embedding pipeline failed with error:", err);
  process.exit(1);
});
