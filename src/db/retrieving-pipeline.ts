import { GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { PineconeStore } from "@langchain/pinecone";
import { PromptTemplate } from "@langchain/core/prompts";
import { Document } from "@langchain/core/documents";
import { z } from "zod";
import { pc } from "./pinecone";

const INDEX_NAME = "pdf-embedded-index";
const NAMESPACE = "pdf-documents";

// 1. Initialize Google Gemini LLM
export const llm = new ChatGoogleGenerativeAI({
  model: "gemini-3.6-flash",
  temperature: 0,
});

// Cache instances
let vectorStoreCache: PineconeStore | null = null;

export async function getVectorStore(): Promise<PineconeStore> {
  if (vectorStoreCache) return vectorStoreCache;

  const embeddings = new GoogleGenerativeAIEmbeddings({
    model: "gemini-embedding-2",
  });

  const indexDescription = await pc.describeIndex(INDEX_NAME);
  const hostPort = indexDescription.host.split(":")[1];
  const hostUrl = `http://jarvis:${hostPort}`;

  const pineconeIndex = pc.index({
    name: INDEX_NAME,
    host: hostUrl,
  });

  vectorStoreCache = await PineconeStore.fromExistingIndex(embeddings, {
    pineconeIndex,
    namespace: NAMESPACE,
  });

  return vectorStoreCache;
}

// 2. Query Vector DB function with retries for rate limits
export async function queryVectorDB(
  query: string,
  topK: number = 5,
): Promise<Document[]> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const store = await getVectorStore();
      const results = await store.similaritySearch(query, topK);
      return results;
    } catch (err: any) {
      if (attempt === 3) throw err;
      // Wait if rate limit occurs
      await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
    }
  }
  return [];
}

// 3. Query Transformation Prompt
const QUERY_TRANSFORMATION_PROMPT = PromptTemplate.fromTemplate(`
You are an expert at query rewriting for semantic search and retrieval-augmented generation (RAG).

Step back and think about the user's underlying intent before rewriting the query.

Instructions:
1. Analyze the original question.
2. Identify the core goal, concepts, and implied context.
3. Generate at least 3 alternative rewritten queries that better express the same intent.
4. Each rewritten query should be clear, specific, and optimized for semantic retrieval.
5. Do NOT add explanations or reasoning.

Original question:
-------
{question}
-------
`);

// 4. Response Generation Prompt
export const GENERATE_RESPONSE_PROMPT = PromptTemplate.fromTemplate(`
You are an assistant for question-answering tasks. Use the following pieces of retrieved context to answer the question. 
If you don't know the answer, just say that you don't know.

Question: {question}

Context: 
{context}

Answer:
`);

// Helper to format documents as a single text string
export const formatDocumentsAsString = (documents: Document[]): string => {
  return documents.map((doc) => doc?.pageContent).join("\n\n---\n\n");
};

// 5. Main RAG Retrieval & Generation Pipeline
export async function runRetrievalPipeline(query: string) {
  console.log(`🔍 Original Query: "${query}"\n`);

  // Step A: Transform query into multiple semantic variations
  console.log("🔄 Generating alternative queries...");
  const structuredLlm = llm.withStructuredOutput(
    z.object({
      questions: z
        .array(z.string())
        .describe("array of questions for semantic search retrieval"),
    })
  );

  const queryChain = QUERY_TRANSFORMATION_PROMPT.pipe(structuredLlm);
  const generatedQueries = await queryChain.invoke({ question: query });
  const queries = generatedQueries?.questions || [query];

  console.log("Generated Rewritten Queries:");
  queries.forEach((q, i) => console.log(`  ${i + 1}. ${q}`));
  console.log("\n📥 Retrieving relevant context from Pinecone...");

  // Step B: Multi-Query Retrieval from Vector DB
  const retrievedDocPromises = queries.map((q) => queryVectorDB(q, 3));
  const retrievedDocsNested = await Promise.all(retrievedDocPromises);

  // Flatten and deduplicate documents by pageContent
  const allDocs = retrievedDocsNested.flat();
  const uniqueDocs = Array.from(
    new Map(allDocs.map((doc) => [doc.pageContent, doc])).values()
  );

  console.log(`Found ${uniqueDocs.length} unique context documents.`);

  // Step C: Format context and generate final response
  const contextText = formatDocumentsAsString(uniqueDocs);
  const responseChain = GENERATE_RESPONSE_PROMPT.pipe(llm);

  console.log("🤖 Generating response with Gemini LLM...\n");
  const aiResponse = await responseChain.invoke({
    question: query,
    context: contextText,
  });

  console.log("==================== ANSWER ====================");
  console.log(aiResponse.content);
  console.log("================================================");

  return aiResponse.content;
}

// Execute sample query if script is run directly
if (import.meta.main) {
  const sampleQuery = "What offenses are defined in the Bharatiya Nyaya Sanhita?";
  runRetrievalPipeline(sampleQuery).catch(console.error);
}
