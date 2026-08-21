import path from "path";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { PineconeStore } from "@langchain/pinecone";
import cliProgress from "cli-progress";
import { pc } from "./db/pinecone";

async function loadLocalPDF() {
  // 1. Supply the path to your local file
  const pdfPath = path.join(import.meta.dir, "data/BNS.pdf");
  const loader = new PDFLoader(pdfPath, {
    splitPages: true, // true (default) splits pages into separate documents
  });

  // 2. Parse the PDF into LangChain Documents
  const docs = await loader.load();

  // 3. Split into chunks
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });

  const splitDocs = await textSplitter.splitDocuments(docs);
  console.log(`Created ${splitDocs.length} chunks.`);

  return splitDocs;
}

function sanitizeMetadata(metadata: Record<string, any>) {
  const cleaned: Record<string, string | number | boolean | string[]> = {};
  for (const [key, val] of Object.entries(metadata)) {
    if (val == null) continue;
    if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
      cleaned[key] = val;
    } else if (Array.isArray(val) && val.every((item) => typeof item === "string")) {
      cleaned[key] = val;
    } else {
      cleaned[key] = JSON.stringify(val);
    }
  }
  return cleaned;
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
  } catch (e) {}

  // 2. Fallback to item-by-item embedding with exponential backoff on rate limits
  const results: number[][] = [];
  for (const text of texts) {
    let vec: number[] = [];
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        const v = await embeddings.embedQuery(text);
        if (v && v.length === 3072) {
          vec = v;
          break;
        }
      } catch (e) {}
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
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

  // 4. Initialize Google Gemini embedding model (gemini-embedding-001)
  console.log("Loading Google Gemini embedding model (gemini-embedding-001)...");
  const embeddings = new GoogleGenerativeAIEmbeddings({
    model: "gemini-embedding-001",
  });

  // 5. Generate embeddings and store in Pinecone with progress bar
  console.log(
    `Embedding and upserting ${splitDocs.length} chunks to Pinecone...`,
  );

  const progressBar = new cliProgress.SingleBar({
    format: "Embedding & Upserting |{bar}| {percentage}% | {value}/{total} Chunks | ETA: {eta}s",
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
      // Upsert records to Pinecone
      await namespace.upsert({ records });
    }

    progressBar.update(Math.min(i + BATCH_SIZE, splitDocs.length));
    // Pause to respect rate limits
    await new Promise((resolve) => setTimeout(resolve, 300));
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
    console.log("✅ Verification successful! 100% of PDF chunks are stored in Pinecone.");
  } else {
    console.warn(
      `⚠️ Mismatch detected: Expected ${splitDocs.length} vectors, but found ${pdfNamespaceCount} in Pinecone.`,
    );
  }
}

indexPdfToPinecone().catch(console.error);
