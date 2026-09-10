import {
  GoogleGenerativeAIEmbeddings,
  ChatGoogleGenerativeAI,
} from "@langchain/google-genai";
import { PineconeStore } from "@langchain/pinecone";
import { PromptTemplate } from "@langchain/core/prompts";
import { Document } from "@langchain/core/documents";
import { z } from "zod";
import { pc } from "./pinecone";
import { withRateLimitRetry } from "./llm-retry";

const INDEX_NAME = "pdf-embedded-index";
const NAMESPACE = "pdf-documents";

const apiKey = process.env.GOOGLE_API_KEY;

// 1. Initialize Google Gemini LLM
export const llm = new ChatGoogleGenerativeAI({
  model: "gemini-3.6-flash",
  temperature: 0,
  apiKey,
});

// Cache instances
let vectorStoreCache: PineconeStore | null = null;

export async function getVectorStore(): Promise<PineconeStore> {
  if (vectorStoreCache) return vectorStoreCache;

  const embeddings = new GoogleGenerativeAIEmbeddings({
    model: "gemini-embedding-2",
    apiKey: process.env.GOOGLE_API_KEY,
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
export const QUERY_TRANSFORMATION_PROMPT = PromptTemplate.fromTemplate(`
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

/**
 * Rewrites the user question into multiple semantic variations for better recall.
 * Falls back to the original query if transformation fails.
 */
export async function generateQueries(question: string): Promise<string[]> {
  try {
    const structuredLlm = llm.withStructuredOutput(
      z.object({
        questions: z
          .array(z.string())
          .describe("array of questions for semantic search retrieval"),
      }),
    );

    return await withRateLimitRetry(async () => {
      const queryChain = QUERY_TRANSFORMATION_PROMPT.pipe(structuredLlm);
      const generatedQueries = await queryChain.invoke({ question });
      return generatedQueries?.questions || [question];
    });
  } catch (err) {
    console.warn(
      "Query transformation failed, falling back to original query:",
      err,
    );
    return [question];
  }
}

/**
 * Runs multi-query retrieval across Pinecone, then flattens and deduplicates
 * the retrieved documents by their page content.
 */
export async function retrieveAndDedupe(
  queries: string[],
): Promise<Document[]> {
  const retrievedDocPromises = queries.map((q) => queryVectorDB(q, 3));
  const retrievedDocsNested = await Promise.all(retrievedDocPromises);

  const allDocs = retrievedDocsNested.flat();
  const uniqueDocs = Array.from(
    new Map(allDocs.map((doc) => [doc.pageContent, doc])).values(),
  );

  return uniqueDocs;
}

/**
 * Formats the question and retrieved documents into the context prompt text.
 */
export async function buildResponsePromptContext(
  question: string,
  docs: Document[],
): Promise<{ contextText: string; finalPromptText: string }> {
  const contextText = formatDocumentsAsString(docs);
  const finalPromptText = await GENERATE_RESPONSE_PROMPT.format({
    question,
    context: contextText,
  });
  return { contextText, finalPromptText };
}

export type AnswerStreamHandler = (text: string) => Promise<void> | void;

/**
 * Streams the final answer to the given handler one chunk at a time, retrying
 * the underlying model call with rate-limit-aware backoff when the provider
 * returns a 429/quota error.
 */
export async function streamAnswer(
  question: string,
  contextText: string,
  onChunk: AnswerStreamHandler,
  options?: { maxAttempts?: number },
): Promise<void> {
  const responseChain = GENERATE_RESPONSE_PROMPT.pipe(llm);

  await withRateLimitRetry(
    async () => {
      const tokenStream = await responseChain.stream({
        question,
        context: contextText,
      });
      for await (const chunk of tokenStream) {
        const content = chunk.content;
        if (typeof content === "string") {
          await onChunk(content);
        } else {
          await onChunk(JSON.stringify(content));
        }
      }
    },
    { maxAttempts: options?.maxAttempts },
  );
}
