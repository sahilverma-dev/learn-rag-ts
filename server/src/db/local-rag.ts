import { PineconeStore } from "@langchain/pinecone";
import { PromptTemplate } from "@langchain/core/prompts";
import type { Document } from "@langchain/core/documents";
import { pc, resolveIndexHostUrl } from "./pinecone";
import { OllamaEmbeddings } from "./ollama-embeddings";
import {
  OLLAMA_LLM_MODEL,
  ThinkTagFilter,
  chatWithOllama,
  streamChatWithOllama,
  stripThinking,
  type ChatMessage,
} from "./ollama";

export const LOCAL_INDEX_NAME =
  process.env.LOCAL_INDEX_NAME ?? "pdf-embedded-index-local";
export const LOCAL_NAMESPACE =
  process.env.LOCAL_NAMESPACE ?? "pdf-documents-local";
export const LOCAL_LLM_MODEL = OLLAMA_LLM_MODEL;
export const LOCAL_TOP_K = Number(process.env.LOCAL_TOP_K ?? 3);
/** Upper bound on how many chunks reach the prompt after merging documents. */
export const LOCAL_MAX_CONTEXT = Number(process.env.LOCAL_MAX_CONTEXT ?? 8);

const INGEST_COMMAND = "bun src/local-embedding-pipeline.ts";

let vectorStoreCache: PineconeStore | null = null;

async function findLocalIndex() {
  const list = await pc.listIndexes();
  return list.indexes?.find((index) => index.name === LOCAL_INDEX_NAME) ?? null;
}

export async function describeLocalIndexStats(): Promise<{
  exists: boolean;
  dimension: number | null;
  recordCount: number;
  namespaces: string[];
} | null> {
  const index = await findLocalIndex();
  if (!index) {
    return { exists: false, dimension: null, recordCount: 0, namespaces: [] };
  }

  const description = await pc.describeIndex(LOCAL_INDEX_NAME);
  const handle = pc.index({
    name: LOCAL_INDEX_NAME,
    host: resolveIndexHostUrl(description.host),
  });
  const stats = await handle.describeIndexStats();

  return {
    exists: true,
    dimension: index.dimension ?? null,
    recordCount: stats.namespaces?.[LOCAL_NAMESPACE]?.recordCount ?? 0,
    namespaces: Object.keys(stats.namespaces ?? {}),
  };
}

export async function getLocalVectorStore(): Promise<PineconeStore> {
  if (vectorStoreCache) return vectorStoreCache;

  const index = await findLocalIndex();
  if (!index) {
    throw new Error(
      `The local vector index "${LOCAL_INDEX_NAME}" does not exist yet. ` +
        `Ingest the documents with Ollama embeddings first: ${INGEST_COMMAND}`,
    );
  }

  const description = await pc.describeIndex(LOCAL_INDEX_NAME);
  const pineconeIndex = pc.index({
    name: LOCAL_INDEX_NAME,
    host: resolveIndexHostUrl(description.host),
  });

  vectorStoreCache = await PineconeStore.fromExistingIndex(
    new OllamaEmbeddings(),
    { pineconeIndex, namespace: LOCAL_NAMESPACE },
  );

  return vectorStoreCache;
}

export function resetLocalVectorStoreCache(): void {
  vectorStoreCache = null;
}

export async function queryLocalVectorDB(
  query: string,
  topK: number = LOCAL_TOP_K,
): Promise<Document[]> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const store = await getLocalVectorStore();
      return await store.similaritySearch(query, topK);
    } catch (err) {
      lastError = err;
      if (attempt === 3) break;
      await sleep(500 * 2 ** (attempt - 1));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export const LOCAL_QUERY_TRANSFORMATION_PROMPT = PromptTemplate.fromTemplate(`
Rewrite the question below into 3 different search queries that mean the same thing.
Write exactly one query per line. Do not number them. Do not explain anything.

Question: {question}

Queries:
`);

export const LOCAL_RESPONSE_PROMPT = PromptTemplate.fromTemplate(`
You answer questions using only the context provided.

Each context passage is labelled with its source in square brackets, for example
[BNS, p.93] or [Constitution, p.171]. The corpus contains the Bharatiya Nyaya
Sanhita (India's criminal law) and the Constitution of India. These are different
documents: never attribute a provision to the wrong one.

Rules:
- If the context does not contain the answer, say that you don't know. Do not use
  outside knowledge, even if you are confident.
- Cite the source of every claim using its label, e.g. "under s.304 of the BNS
  (p.93)" or "Article 21 of the Constitution (p.71)".
- Be concise. Do not restate the question.
- Format enumerations as a markdown list, one item per line: start each item
  with "- " (or "1. " for ordered lists). Never run list items together on a
  single line.

Context:
{context}

Question: {question}

Answer:
`);

/**
 * Pulls usable queries out of a small model's free-form reply, tolerating
 * bullets, numbering, and leftover reasoning text.
 */
export function parseGeneratedQueries(text: string, fallback: string): string[] {
  const lines = stripThinking(String(text ?? ""))
    .split("\n")
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
    .filter((line) => line.length > 3 && line.length <= 300);

  const unique = Array.from(new Set(lines)).slice(0, 4);
  return unique.length > 0 ? unique : [fallback];
}

/**
 * Expands the question locally. The original wording is always kept so a weak
 * local model can never retrieve less than a single-query search would.
 */
export async function generateLocalQueries(question: string): Promise<string[]> {
  try {
    const promptText = await LOCAL_QUERY_TRANSFORMATION_PROMPT.format({
      question,
    });
    const { content } = await chatWithOllama(
      [{ role: "user", content: promptText }],
      { maxTokens: 256, timeoutMs: 5_000 },
    );

    const queries = parseGeneratedQueries(content, question);
    return Array.from(new Set([question, ...queries]));
  } catch (err) {
    console.warn(
      "Local query transformation timed out or failed, falling back to original query:",
      err instanceof Error ? err.message : err,
    );
    return [question];
  }
}

/**
 * Interleaves results across documents so one document cannot crowd out the
 * other. With several queries against a combined corpus, plain score ordering
 * happily returns every chunk from whichever document matched best, which
 * defeats the point of holding two documents in one index.
 *
 * Relevance order is preserved *within* each document (the search result order),
 * and de-duplication happens first so a repeated chunk is not counted twice.
 */
export function interleaveByDocument(
  docs: Document[],
  maxTotal: number = LOCAL_MAX_CONTEXT,
): Document[] {
  const seen = new Set<string>();
  const groups = new Map<string, Document[]>();
  const documentOrder: string[] = [];

  for (const doc of docs) {
    const content = doc.pageContent;
    if (seen.has(content)) continue;
    seen.add(content);

    const key = String(doc.metadata?.documentId ?? "unknown");
    if (!groups.has(key)) {
      groups.set(key, []);
      documentOrder.push(key);
    }
    groups.get(key)!.push(doc);
  }

  const merged: Document[] = [];
  for (let rank = 0; merged.length < maxTotal; rank++) {
    let addedThisRound = false;

    for (const key of documentOrder) {
      const group = groups.get(key);
      const doc = group?.[rank];
      if (!doc) continue;

      merged.push(doc);
      addedThisRound = true;
      if (merged.length >= maxTotal) break;
    }

    if (!addedThisRound) break;
  }

  return merged;
}

export async function retrieveAndDedupeLocal(
  queries: string[],
): Promise<Document[]> {
  const nested = await Promise.all(queries.map((q) => queryLocalVectorDB(q)));
  return interleaveByDocument(nested.flat());
}

/**
 * Builds the context block with a citation label per chunk. Without the label
 * the model has no idea which document, article, or page a passage came from, so
 * it cannot cite anything even though the prompt asks it to.
 */
export function formatLocalContext(docs: Document[]): string {
  return docs
    .map((doc) => {
      const meta = (doc.metadata ?? {}) as Record<string, unknown>;
      const citation = String(meta.citation ?? meta.documentId ?? "Source");
      const article = String(meta.article ?? "");
      const title = String(meta.title ?? "");
      const part = String(meta.part ?? "");
      const page = Number(meta.source_page ?? 0);

      const heading = [
        `${citation}${page > 0 ? ` p.${page}` : ""}`,
        article,
        title ? `"${title}"` : null,
        part,
      ]
        .filter(Boolean)
        .join(" · ");

      return `[${heading}]\n${doc.pageContent}`;
    })
    .join("\n\n---\n\n");
}

export async function buildLocalResponsePromptContext(
  question: string,
  docs: Document[],
): Promise<{ contextText: string; finalPromptText: string }> {
  const contextText = formatLocalContext(docs);
  const finalPromptText = await LOCAL_RESPONSE_PROMPT.format({
    question,
    context: contextText,
  });
  return { contextText, finalPromptText };
}

export interface LocalAnswerHandlers {
  onToken: (text: string) => Promise<void> | void;
  onThinking?: (text: string) => Promise<void> | void;
}

/**
 * Streams the answer from the local model, routing reasoning output to
 * `onThinking` so it never lands in the visible answer.
 */
export async function streamLocalAnswer(
  question: string,
  contextText: string,
  handlers: LocalAnswerHandlers,
  options: { model?: string; maxAttempts?: number } = {},
): Promise<void> {
  const promptText = await LOCAL_RESPONSE_PROMPT.format({
    question,
    context: contextText,
  });
  const messages: ChatMessage[] = [{ role: "user", content: promptText }];
  const maxAttempts = options.maxAttempts ?? 3;

  let emitted = false;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const filter = new ThinkTagFilter();

    try {
      for await (const chunk of streamChatWithOllama(messages, {
        model: options.model,
        maxTokens: 1024,
        timeoutMs: 0,
      })) {
        if (chunk.thinking) {
          emitted = true;
          await handlers.onThinking?.(chunk.thinking);
        }
        if (!chunk.content) continue;

        const split = filter.push(chunk.content);
        if (split.thinking) {
          emitted = true;
          await handlers.onThinking?.(split.thinking);
        }
        if (split.answer) {
          emitted = true;
          await handlers.onToken(split.answer);
        }
      }

      const tail = filter.flush();
      if (tail.thinking) {
        emitted = true;
        await handlers.onThinking?.(tail.thinking);
      }
      if (tail.answer) {
        emitted = true;
        await handlers.onToken(tail.answer);
      }
      return;
    } catch (err) {
      // Retrying after tokens have been written would duplicate output.
      if (emitted || attempt === maxAttempts) throw err;
      console.warn(
        `[Attempt ${attempt}/${maxAttempts}] Local generation failed, retrying:`,
        err,
      );
      await sleep(500 * 2 ** (attempt - 1));
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
