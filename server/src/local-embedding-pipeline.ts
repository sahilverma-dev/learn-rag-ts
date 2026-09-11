/**
 * Ingestion pipeline for locally hosted Ollama models.
 *
 * Chunks every document in LEGAL_DOCUMENTS by its own structure (articles for
 * the Constitution, sections for the BNS) and upserts into LOCAL_INDEX_NAME,
 * creating or recreating the index so its dimension always matches the model.
 *
 *   bun src/local-embedding-pipeline.ts            # clean rebuild of all docs
 *   bun src/local-embedding-pipeline.ts --keep     # keep existing vectors
 *
 * Because chunks are unit-scoped rather than page-scoped, a single provision
 * retrieves as one coherent passage, and each carries the metadata needed to
 * cite it (document, part, article, title, source_page, document_version).
 */
import cliProgress from "cli-progress";
import { pc, resolveIndexHostUrl } from "./db/pinecone";
import { sanitizeMetadata } from "./db/ingest-utils";
import { OllamaEmbeddings } from "./db/ollama-embeddings";
import {
  OLLAMA_EMBEDDING_MODEL,
  embedWithOllama,
  isModelAvailable,
  listOllamaModels,
  probeEmbeddingDimension,
} from "./db/ollama";
import { LOCAL_INDEX_NAME, LOCAL_NAMESPACE } from "./db/local-rag";
import {
  LEGAL_DOCUMENTS,
  chunkLegalDocument,
  legalDocumentPath,
  loadPdfLines,
  type LegalChunk,
  type LegalDocumentSpec,
} from "./db/legal-chunker";

const BATCH_SIZE = 8;

async function ensureOllamaModel() {
  const models = await listOllamaModels();
  if (!isModelAvailable(models, OLLAMA_EMBEDDING_MODEL)) {
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

/**
 * Chunk ids are document-scoped, so vectors left by an older scheme would linger
 * as unreachable junk. Clearing is also what makes a full re-embed well defined
 * (this pipeline does not do partial ingestion).
 */
async function clearNamespace(
  index: ReturnType<typeof pc.index>,
  keepExisting: boolean,
) {
  if (keepExisting) {
    console.log(
      `--keep set: existing vectors in "${LOCAL_NAMESPACE}" are left in place.`,
    );
    return;
  }

  const namespace = index.namespace(LOCAL_NAMESPACE);
  const stats = await index.describeIndexStats();
  const existing = stats.namespaces?.[LOCAL_NAMESPACE]?.recordCount ?? 0;

  if (existing > 0) {
    console.log(
      `Clearing ${existing} existing vectors from "${LOCAL_NAMESPACE}" for a clean rebuild...`,
    );
    await namespace.deleteAll();
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
}

/** Confirms a document is actually reachable through a filtered query. */
async function verifyRetrievable(
  index: ReturnType<typeof pc.index>,
  documents: LegalDocumentSpec[],
) {
  const [probe] = await embedWithOllama("punishment for theft fundamental right");
  if (!probe) {
    console.warn("Skipping retrievability check: could not embed a probe query.");
    return;
  }
  const namespace = index.namespace(LOCAL_NAMESPACE);

  console.log("\n--- Retrievability per document ---");

  for (const document of documents) {
    try {
      const response = await namespace.query({
        vector: probe,
        topK: 1,
        includeMetadata: true,
        filter: { documentId: { $eq: document.id } },
      });
      const hit = response.matches?.[0];
      if (hit) {
        console.log(
          `  ✅ ${document.citation}: reachable (top match ${hit.id} — ${String(hit.metadata?.article ?? "")})`,
        );
      } else {
        console.warn(`  ⚠️  ${document.citation}: no match for its document filter`);
      }
    } catch (err) {
      console.warn(
        `  ⚠️  ${document.citation}: filter query failed — ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
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

async function ingest() {
  const keepExisting = process.argv.includes("--keep");

  await ensureOllamaModel();

  console.log(
    `Probing embedding dimension for "${OLLAMA_EMBEDDING_MODEL}" on Ollama...`,
  );
  const dimension = await probeEmbeddingDimension(OLLAMA_EMBEDDING_MODEL);
  console.log(`Embedding dimension: ${dimension}\n`);

  const pineconeIndex = await ensureIndex(dimension);
  await clearNamespace(pineconeIndex, keepExisting);

  console.log(`Chunking ${LEGAL_DOCUMENTS.length} document(s) by structure...`);
  const perDocument: Array<{ spec: LegalDocumentSpec; chunks: LegalChunk[] }> = [];

  for (const spec of LEGAL_DOCUMENTS) {
    const lines = await loadPdfLines(legalDocumentPath(spec));
    const chunks = await chunkLegalDocument(lines, spec);
    const titled = chunks.filter((c) => c.metadata.title).length;
    console.log(
      `  ${spec.citation}: ${chunks.length} chunks (${titled} with titles)`,
    );
    perDocument.push({ spec, chunks });
  }

  const allChunks = perDocument.flatMap((entry) => entry.chunks);
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

  const namespace = pineconeIndex.namespace(LOCAL_NAMESPACE);
  progressBar.start(allChunks.length, 0);

  let upserted = 0;
  let dropped = 0;

  for (let i = 0; i < allChunks.length; i += BATCH_SIZE) {
    const batch = allChunks.slice(i, i + BATCH_SIZE);
    const vectors = await embeddings.embedDocuments(batch.map((c) => c.text));

    const records = batch
      .map((chunk, idx) => ({
        id: chunk.id,
        values: vectors[idx] ?? [],
        metadata: sanitizeMetadata({
          text: chunk.text,
          ...chunk.metadata,
        }) as Record<string, string | number | boolean | string[]>,
      }))
      .filter((record) => {
        const ok = record.values.length === dimension;
        if (!ok) dropped++;
        return ok;
      });

    if (records.length > 0) {
      await upsertWithRetry(() => namespace.upsert({ records }));
      upserted += records.length;
    }

    progressBar.update(Math.min(i + BATCH_SIZE, allChunks.length));
  }

  progressBar.stop();
  console.log("\nUpsert completed.");

  const stats = await pineconeIndex.describeIndexStats();
  const stored = stats.namespaces?.[LOCAL_NAMESPACE]?.recordCount ?? 0;

  console.log("\n--- Index Verification ---");
  for (const { spec, chunks } of perDocument) {
    console.log(`  ${spec.citation} (${spec.label}, v${spec.version}): ${chunks.length} chunks`);
  }
  console.log(`Chunks upserted: ${upserted}${dropped ? ` (${dropped} dropped: wrong dimension)` : ""}`);
  console.log(`Vectors in "${LOCAL_NAMESPACE}": ${stored}`);

  if (stored === upserted && dropped === 0) {
    console.log("✅ Verification successful: every chunk is stored in Pinecone.");
  } else {
    console.warn(
      `⚠️ Mismatch: expected ${upserted} vectors, found ${stored}. ` +
        `Re-run without --keep for a clean rebuild.`,
    );
  }

  await verifyRetrievable(pineconeIndex, LEGAL_DOCUMENTS);
}

ingest().catch((err) => {
  console.error("\n❌ Local embedding pipeline failed:", err);
  process.exit(1);
});
