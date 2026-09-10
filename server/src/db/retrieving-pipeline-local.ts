/**
 * Local retrieval + generation pipeline (Ollama), the counterpart to
 * retrieving-pipeline.ts (Gemini) and retrieving-pipeline-opencode.ts.
 *
 *   bun src/db/retrieving-pipeline-local.ts ["your question"]
 *
 * Expands the query with the local LLM, embeds it with the local embedding
 * model, searches the local Pinecone index, then streams the answer.
 * Pass --no-generate to stop after retrieval and skip the LLM call.
 */
import { OLLAMA_EMBEDDING_MODEL, OLLAMA_LLM_MODEL } from "./ollama";
import {
  LOCAL_INDEX_NAME,
  LOCAL_NAMESPACE,
  LOCAL_TOP_K,
  buildLocalResponsePromptContext,
  describeLocalIndexStats,
  generateLocalQueries,
  retrieveAndDedupeLocal,
  streamLocalAnswer,
} from "./local-rag";

export interface LocalPipelineOptions {
  /** Skip the LLM answer and stop once context is retrieved. */
  retrievalOnly?: boolean;
  topK?: number;
}

async function preflight() {
  const stats = await describeLocalIndexStats();

  if (!stats?.exists) {
    throw new Error(
      `Index "${LOCAL_INDEX_NAME}" does not exist. Run the local embedding pipeline first:\n` +
        `  bun src/local-embedding-pipeline.ts`,
    );
  }

  console.log(
    `📊 Index "${LOCAL_INDEX_NAME}": ${stats.recordCount} vectors in "${LOCAL_NAMESPACE}" ` +
      `(dimension ${stats.dimension})`,
  );

  if (stats.recordCount === 0) {
    throw new Error(
      `Index "${LOCAL_INDEX_NAME}" has no vectors in namespace "${LOCAL_NAMESPACE}". ` +
        `Run: bun src/local-embedding-pipeline.ts`,
    );
  }

  return stats;
}

export async function runLocalRetrievalPipeline(
  query: string,
  options: LocalPipelineOptions = {},
): Promise<{ answer: string; thinking: string }> {
  console.log(`\n🚀 [Local Pipeline] Query: "${query}"`);
  console.log(`   Embeddings : ${OLLAMA_EMBEDDING_MODEL}`);
  console.log(`   LLM        : ${OLLAMA_LLM_MODEL}`);
  console.log(`   Retrieval  : topK ${options.topK ?? LOCAL_TOP_K}\n`);

  await preflight();

  console.log("\n🔄 Expanding query with the local model...");
  const queries = await generateLocalQueries(query);
  queries.forEach((q, i) => console.log(`  ${i + 1}. ${q}`));

  console.log("\n📥 Retrieving relevant context from the local index...");
  const uniqueDocs = await retrieveAndDedupeLocal(queries);
  console.log(`Found ${uniqueDocs.length} unique context documents.`);

  uniqueDocs.forEach((doc, i) => {
    const snippet = doc.pageContent.slice(0, 160).replace(/\s+/g, " ");
    console.log(`\n  [${i + 1}] ${JSON.stringify(doc.metadata)}`);
    console.log(`      ${snippet}...`);
  });

  if (options.retrievalOnly) {
    console.log("\n⏭️  --no-generate set; skipping the LLM answer.");
    return { answer: "", thinking: "" };
  }

  const { contextText } = await buildLocalResponsePromptContext(
    query,
    uniqueDocs,
  );

  console.log(`\n🤖 Generating response with ${OLLAMA_LLM_MODEL}...\n`);
  console.log("==================== ANSWER ====================");

  let answer = "";
  let thinking = "";

  await streamLocalAnswer(query, contextText, {
    onToken: (text) => {
      answer += text;
      process.stdout.write(text);
    },
    onThinking: (text) => {
      thinking += text;
    },
  });

  console.log("\n================================================");

  const trimmedThinking = thinking.trim();
  if (trimmedThinking) {
    const words = trimmedThinking.split(/\s+/).filter(Boolean).length;
    console.log(`\n💭 Reasoning (${words} words, hidden from the answer above):`);
    console.log(trimmedThinking);
  }

  return { answer, thinking: trimmedThinking };
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const retrievalOnly = args.includes("--no-generate");
  const query =
    args
      .filter((arg) => !arg.startsWith("--"))
      .join(" ")
      .trim() || "What is the punishment for theft under the Bharatiya Nyaya Sanhita?";

  runLocalRetrievalPipeline(query, { retrievalOnly }).catch((err) => {
    console.error("\n❌ Local retrieval pipeline failed:", err);
    process.exit(1);
  });
}
