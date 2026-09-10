/**
 * Smoke test for local embeddings + vector search, without invoking the LLM.
 *
 *   bun src/test-local-retrieval.ts ["your query"]
 *
 * Use this to verify that Ollama embedding works and that the local index is
 * queryable; it isolates those from the slower LLM generation step.
 */
import { pc, resolveIndexHostUrl } from "./db/pinecone";
import { OllamaEmbeddings } from "./db/ollama-embeddings";
import { OLLAMA_EMBEDDING_MODEL, probeEmbeddingDimension } from "./db/ollama";
import {
  LOCAL_INDEX_NAME,
  LOCAL_NAMESPACE,
  LOCAL_TOP_K,
  describeLocalIndexStats,
} from "./db/local-rag";

export async function testLocalRetrieval(
  queryText: string,
  topK: number = LOCAL_TOP_K,
) {
  console.log(`Describing index "${LOCAL_INDEX_NAME}"...`);
  const stats = await describeLocalIndexStats();

  if (!stats?.exists || stats.recordCount === 0) {
    throw new Error(
      `Index "${LOCAL_INDEX_NAME}" has no vectors in namespace "${LOCAL_NAMESPACE}". ` +
        `Run the local embedding pipeline first:\n  bun src/local-embedding-pipeline.ts`,
    );
  }

  console.log(
    `📊 ${stats.recordCount} vectors in "${LOCAL_NAMESPACE}" (dimension ${stats.dimension})`,
  );

  const description = await pc.describeIndex(LOCAL_INDEX_NAME);

  const index = pc.index({
    name: LOCAL_INDEX_NAME,
    host: resolveIndexHostUrl(description.host),
  });

  console.log(`Probing "${OLLAMA_EMBEDDING_MODEL}"...`);
  const dimension = await probeEmbeddingDimension(OLLAMA_EMBEDDING_MODEL);
  console.log(`Embedding model dimension: ${dimension}`);
  console.log(`Index dimension:            ${description.dimension}`);

  if (description.dimension !== dimension) {
    console.warn(
      `\n⚠️  Dimension mismatch: the index stores ${description.dimension}-dim vectors ` +
        `but "${OLLAMA_EMBEDDING_MODEL}" produces ${dimension}-dim vectors.\n` +
        `   Re-embed with: bun src/local-embedding-pipeline.ts`,
    );
  }

  const embeddings = new OllamaEmbeddings();
  console.log(`\n🔍 Querying: "${queryText}"`);
  const queryVector = await embeddings.embedQuery(queryText);
  console.log(`Generated query vector (${queryVector.length} dimensions).`);

  const namespace = index.namespace(LOCAL_NAMESPACE);
  const response = await namespace.query({
    vector: queryVector,
    topK,
    includeMetadata: true,
  });

  const matches = response.matches ?? [];
  console.log(`\n--- Top ${matches.length} matches from "${LOCAL_NAMESPACE}" ---`);

  matches.forEach((match, idx) => {
    console.log(`\nMatch #${idx + 1} (Score: ${match.score?.toFixed(4) ?? "n/a"}):`);
    console.log(`ID: ${match.id}`);
    if (match.metadata) {
      console.log(`Text snippet:\n${String(match.metadata.text).slice(0, 300)}...`);
    }
  });

  if (matches.length === 0) {
    console.warn(
      `\n⚠️  No matches returned. The namespace "${LOCAL_NAMESPACE}" may be empty — ` +
        `run: bun src/local-embedding-pipeline.ts`,
    );
  }

  return matches;
}

if (import.meta.main) {
  const queryText =
    process.argv.slice(2).join(" ").trim() ||
    "What is the punishment for theft?";

  testLocalRetrieval(queryText).catch((err) => {
    console.error("\n❌ Local retrieval test failed:", err);
    process.exit(1);
  });
}
