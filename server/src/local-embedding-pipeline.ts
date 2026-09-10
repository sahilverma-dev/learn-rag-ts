/**
 * Ingestion pipeline for locally hosted Ollama models.
 *
 * Embeds data/BNS.pdf with OLLAMA_EMBEDDING_MODEL (default
 * mxbai-embed-large) and upserts into LOCAL_INDEX_NAME, creating or
 * recreating the index so its dimension always matches the model.
 *
 *   bun src/local-embedding-pipeline.ts
 */
import path from "path";
import cliProgress from "cli-progress";
import { pc, resolveIndexHostUrl } from "./db/pinecone";
import { loadPdfChunks, sanitizeMetadata } from "./db/ingest-utils";
import { OllamaEmbeddings } from "./db/ollama-embeddings";
import {
  OLLAMA_EMBEDDING_MODEL,
  listOllamaModels,
  probeEmbeddingDimension,
} from "./db/ollama";
import { LOCAL_INDEX_NAME, LOCAL_NAMESPACE } from "./db/local-rag";

const PDF_PATH = path.join(import.meta.dir, "data/BNS.pdf");
const BATCH_SIZE = 8;

async function ensureOllamaModel() {
  const models = await listOllamaModels();
  if (!models.some((name) => name === OLLAMA_EMBEDDING_MODEL)) {
    throw new Error(
      `Model "${OLLAMA_EMBEDDING_MODEL}" is not available on the Ollama host. ` +
        `Pull it first with: ollama pull ${OLLAMA_EMBEDDING_MODEL}`,
    );
  }
}

async function ensureIndex(dimension: number) {
  const list = await pc.listIndexes();
  const existing = list.indexes?.find((index) => index.name === LOCAL_INDEX_NAME);

  if (existing && existing.dimension !== dimension) {
    console.log(
      `Deleting index "${LOCAL_INDEX_NAME}" with dimension ${existing.dimension} (expected ${dimension})...`,
    );
    await pc.deleteIndex(LOCAL_INDEX_NAME);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  const refreshed = await pc.listIndexes();
  const exists = refreshed.indexes?.some(
    (index) => index.name === LOCAL_INDEX_NAME,
  );

  if (!exists) {
    console.log(
      `Creating index "${LOCAL_INDEX_NAME}" with ${dimension} dimensions...`,
    );
    await pc.createIndex({
      name: LOCAL_INDEX_NAME,
      dimension,
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

  const description = await pc.describeIndex(LOCAL_INDEX_NAME);
  return pc.index({
    name: LOCAL_INDEX_NAME,
    host: resolveIndexHostUrl(description.host),
  });
}

async function ingest() {
  await ensureOllamaModel();

  console.log(
    `Probing embedding dimension for "${OLLAMA_EMBEDDING_MODEL}" on Ollama...`,
  );
  const dimension = await probeEmbeddingDimension(OLLAMA_EMBEDDING_MODEL);
  console.log(`Embedding dimension: ${dimension}`);

  const pineconeIndex = await ensureIndex(dimension);

  const splitDocs = await loadPdfChunks(PDF_PATH);
  console.log(`Created ${splitDocs.length} chunks from ${PDF_PATH}.`);

  const embeddings = new OllamaEmbeddings({
    model: OLLAMA_EMBEDDING_MODEL,
    batchSize: BATCH_SIZE,
  });

  const progressBar = new cliProgress.SingleBar({
    format:
      "Embedding & Upserting |{bar}| {percentage}% | {value}/{total} Chunks | ETA: {eta}s",
    barCompleteChar: "\u2588",
    barIncompleteChar: "\u2591",
    hideCursor: true,
  });

  progressBar.start(splitDocs.length, 0);

  const namespace = pineconeIndex.namespace(LOCAL_NAMESPACE);

  for (let i = 0; i < splitDocs.length; i += BATCH_SIZE) {
    const batchDocs = splitDocs.slice(i, i + BATCH_SIZE);
    const vectors = await embeddings.embedDocuments(
      batchDocs.map((doc) => doc.pageContent),
    );

    const records = batchDocs
      .map((doc, idx) => ({
        id: `doc-${i + idx}`,
        values: vectors[idx],
        metadata: sanitizeMetadata({
          text: doc.pageContent,
          ...doc.metadata,
        }),
      }))
      .filter((record) => record.values?.length === dimension);

    if (records.length > 0) {
      await upsertWithRetry(() => namespace.upsert({ records }));
    }

    progressBar.update(Math.min(i + BATCH_SIZE, splitDocs.length));
  }

  progressBar.stop();
  console.log("\nUpsert completed successfully.");

  const stats = await pineconeIndex.describeIndexStats();
  const stored = stats.namespaces?.[LOCAL_NAMESPACE]?.recordCount ?? 0;

  console.log("\n--- Index Verification ---");
  console.log(`Chunks created from PDF: ${splitDocs.length}`);
  console.log(`Vectors in "${LOCAL_NAMESPACE}": ${stored}`);

  if (stored === splitDocs.length) {
    console.log(
      "✅ Verification successful! 100% of PDF chunks are stored in Pinecone.",
    );
  } else {
    console.warn(
      `⚠️ Mismatch detected: expected ${splitDocs.length} vectors, found ${stored}.`,
    );
  }
}

async function upsertWithRetry(operation: () => Promise<unknown>): Promise<void> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await operation();
      return;
    } catch (err) {
      lastError = err;
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

ingest().catch((err) => {
  console.error("\n❌ Local embedding pipeline failed:", err);
  process.exit(1);
});
