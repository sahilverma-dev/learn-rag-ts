import { queryVectorDB, formatDocumentsAsString } from "./retrieving-pipeline";
import { Document } from "@langchain/core/documents";

const OPENCODE_ZEN_ENDPOINT = "https://opencode.ai/zen/v1/chat/completions";
const OPENCODE_MODEL = "x-preview-f-free";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Helper to invoke OpenCode Zen LLM endpoint (https://opencode.ai/zen/v1/chat/completions)
 */
export async function callOpenCodeLLM(
  messages: ChatMessage[],
  maxTokens: number = 1024,
): Promise<string> {
  const response = await fetch(OPENCODE_ZEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENCODE_MODEL,
      messages,
      max_tokens: maxTokens,
      stream: false,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(
      `OpenCode API Error [${response.status} ${response.statusText}]: ${errText}`,
    );
  }

  const data = (await response.json()) as any;
  return data.choices[0]?.message?.content || "";
}

/**
 * Step A: Rewrite user query into alternative variations using OpenCode LLM
 */
export async function generateAlternativeQueries(
  originalQuery: string,
): Promise<string[]> {
  const systemPrompt = `You are an expert at query rewriting for semantic search and retrieval-augmented generation (RAG).
Generate 3 alternative rewritten queries that express the same underlying intent.
Output ONLY a JSON array of strings, for example: ["query 1", "query 2", "query 3"]. Do NOT output any reasoning or extra text.`;

  const prompt = `Original Question: "${originalQuery}"`;

  try {
    const rawResponse = await callOpenCodeLLM([
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ]);

    // Extract JSON array from response
    const jsonMatch = rawResponse.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((q) => String(q));
      }
    }
  } catch (err) {
    console.warn(
      "⚠️ Alternative query generation failed, falling back to original query.",
      err,
    );
  }

  return [originalQuery];
}

/**
 * Main RAG Pipeline using OpenCode Zen API for LLM completion post-retrieval
 */
export async function runOpenCodeRetrievalPipeline(query: string) {
  console.log(`\n🚀 [OpenCode Pipeline] Original Query: "${query}"\n`);

  // Step 1: Query Transformation
  console.log("🔄 Generating alternative queries via OpenCode LLM...");
  const queries = await generateAlternativeQueries(query);

  console.log("Generated Rewritten Queries:");
  queries.forEach((q, i) => console.log(`  ${i + 1}. ${q}`));

  // Step 2: Multi-Query Vector Retrieval from Pinecone
  console.log("\n📥 Retrieving relevant context from Pinecone...");
  const docPromises = queries.map((q) => queryVectorDB(q, 3));
  const nestedDocs = await Promise.all(docPromises);

  // Flatten and deduplicate retrieved context
  const allDocs = nestedDocs.flat();
  const uniqueDocs = Array.from(
    new Map(allDocs.map((doc) => [doc.pageContent, doc])).values(),
  );

  console.log(`Found ${uniqueDocs.length} unique context documents.`);

  // Step 3: Format Context
  const contextText = formatDocumentsAsString(uniqueDocs);

  // Step 4: Final LLM Call using OpenCode Zen API
  console.log(
    "🤖 Generating response via OpenCode LLM (x-preview-f-free)...\n",
  );

  const systemMessage = `You are an assistant for question-answering tasks. Use the following pieces of retrieved context to answer the question. 
If you don't know the answer, just say that you don't know.`;

  const userMessage = `Question: ${query}

Context:
${contextText}

Answer:`;

  const responseText = await callOpenCodeLLM([
    { role: "system", content: systemMessage },
    { role: "user", content: userMessage },
  ]);

  console.log("==================== ANSWER ====================");
  console.log(responseText);
  console.log("================================================");

  return responseText;
}

// Execute sample run if called directly
if (import.meta.main) {
  const sampleQuery =
    "What offenses are defined in the Bharatiya Nyaya Sanhita?";
  runOpenCodeRetrievalPipeline(sampleQuery).catch(console.error);
}
