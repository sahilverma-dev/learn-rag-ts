import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import {
  generateQueries,
  retrieveAndDedupe,
  buildResponsePromptContext,
  streamAnswer,
} from "./db/rag-helpers";
import { LLMRateLimitError } from "./db/llm-retry";
import { OllamaError, checkOllamaHealth } from "./db/ollama";
import {
  SCOPE_GUARD_ENABLED,
  buildOffTopicReply,
  buildSmallTalkReply,
  classifyScope,
  detectSmallTalk,
} from "./db/intent";
import {
  LOCAL_INDEX_NAME,
  LOCAL_LLM_MODEL,
  buildLocalResponsePromptContext,
  describeLocalIndexStats,
  generateLocalQueries,
  retrieveAndDedupeLocal,
  streamLocalAnswer,
} from "./db/local-rag";

const app = new Hono();

// CORS restricted to the local frontend origin
app.use("*", cors());

app.get("/", (c) => c.json({ ok: true }));

interface SseWriter {
  writeSSE(message: { event: string; data: string }): Promise<void>;
}

/**
 * Reports a failure to the client as a single structured `error` frame.
 *
 * Hono's streamSSE appends its own bare `error` frame after a handler throws,
 * which would overwrite this payload, so the handlers below catch their own
 * errors instead of relying on streamSSE's onError argument.
 */
async function writeErrorEvent(
  stream: SseWriter,
  error: unknown,
): Promise<void> {
  const payload =
    error instanceof LLMRateLimitError
      ? {
          type: "rate_limit",
          message: error.message,
          retryAfter: error.retryAfterSeconds,
        }
      : error instanceof OllamaError
        ? { type: "local_model", message: error.message }
        : {
            type: "error",
            message: error instanceof Error ? error.message : String(error),
          };

  await stream.writeSSE({ event: "error", data: JSON.stringify(payload) });
}

/**
 * SSE streaming RAG endpoint.
 *
 * Emits `status` events during query transformation and retrieval, a
 * `sources` event with the deduplicated context, `token` events as the LLM
 * generates the answer, and a final `done` event.
 */
app.get("/chat", (c) => {
  const question = c.req.query("question")?.trim() ?? "";

  if (!question) {
    return c.json(
      { error: "Missing or empty 'question' query parameter." },
      400,
    );
  }

  return streamSSE(c, async (stream) => {
    try {
      // 1. Query transformation
      await stream.writeSSE({ event: "status", data: "Transforming query..." });
      const queries = await generateQueries(question);

      // 2. Multi-query retrieval + dedupe
      await stream.writeSSE({
        event: "status",
        data: "Retrieving context from Pinecone...",
      });
      const uniqueDocs = await retrieveAndDedupe(queries);

      await stream.writeSSE({
        event: "status",
        data: `Found ${uniqueDocs.length} context documents.`,
      });

      await stream.writeSSE({
        event: "sources",
        data: JSON.stringify(
          uniqueDocs.map((doc) => ({
            metadata: doc.metadata,
            text: doc.pageContent.slice(0, 500),
          })),
        ),
      });

      // 3. Stream the LLM answer token-by-token (retries on rate limits)
      const { contextText } = await buildResponsePromptContext(
        question,
        uniqueDocs,
      );
      await streamAnswer(question, contextText, (text) =>
        stream.writeSSE({ event: "token", data: text }),
      );

      await stream.writeSSE({ event: "done", data: "" });
    } catch (error) {
      await writeErrorEvent(stream, error);
    }
  });
});

/**
 * Reports whether the local Ollama models and the local Pinecone index are
 * ready, so the client can explain what is missing instead of failing opaquely.
 */
app.get("/local/health", async (c) => {
  const ollama = await checkOllamaHealth();

  let index = null;
  let indexError: string | null = null;

  try {
    const stats = await describeLocalIndexStats();
    index = stats ? { ...stats, name: LOCAL_INDEX_NAME } : null;
  } catch (err) {
    indexError = err instanceof Error ? err.message : String(err);
  }

  return c.json({
    ok: ollama.reachable && Boolean(index?.recordCount),
    ollama,
    index,
    indexError,
    llmModel: LOCAL_LLM_MODEL,
  });
});

/**
 * SSE streaming RAG endpoint backed entirely by models on the local network.
 *
 * Same event contract as `/chat`, plus `thinking` events carrying the reasoning
 * output of reasoning models (e.g. deepseek-r1) so it stays out of the answer.
 *
 * Requests are routed before retrieval: small talk and off-topic questions are
 * answered directly so they never pay for embeddings or a vector search.
 */
app.get("/local/chat", (c) => {
  const question = c.req.query("question")?.trim() ?? "";

  if (!question) {
    return c.json(
      { error: "Missing or empty 'question' query parameter." },
      400,
    );
  }

  return streamSSE(c, async (stream) => {
    try {
      // 0. Routing — no retrieval for greetings or out-of-scope questions.
      const smallTalk = detectSmallTalk(question);
      if (smallTalk) {
        await stream.writeSSE({
          event: "token",
          data: buildSmallTalkReply(smallTalk),
        });
        await stream.writeSSE({ event: "done", data: "" });
        return;
      }

      if (SCOPE_GUARD_ENABLED) {
        await stream.writeSSE({
          event: "status",
          data: "Checking whether this is in scope...",
        });
        const verdict = await classifyScope(question);
        if (verdict === "irrelevant") {
          await stream.writeSSE({
            event: "token",
            data: buildOffTopicReply(),
          });
          await stream.writeSSE({ event: "done", data: "" });
          return;
        }
      }

      await stream.writeSSE({
        event: "status",
        data: "Expanding query with the local model...",
      });
      const queries = await generateLocalQueries(question);

      await stream.writeSSE({
        event: "status",
        data: `Searching ${LOCAL_INDEX_NAME} with ${queries.length} ${queries.length === 1 ? "query" : "queries"}...`,
      });
      const uniqueDocs = await retrieveAndDedupeLocal(queries);

      await stream.writeSSE({
        event: "status",
        data: `Found ${uniqueDocs.length} context documents.`,
      });

      await stream.writeSSE({
        event: "sources",
        data: JSON.stringify(
          uniqueDocs.map((doc) => ({
            metadata: doc.metadata,
            text: doc.pageContent.slice(0, 500),
          })),
        ),
      });

      const { contextText } = await buildLocalResponsePromptContext(
        question,
        uniqueDocs,
      );
      await streamLocalAnswer(question, contextText, {
        onToken: (text) => stream.writeSSE({ event: "token", data: text }),
        onThinking: (text) =>
          stream.writeSSE({ event: "thinking", data: text }),
      });

      await stream.writeSSE({ event: "done", data: "" });
    } catch (error) {
      await writeErrorEvent(stream, error);
    }
  });
});

// Bun auto-detects the Hono default export and starts the HTTP server.
//
// idleTimeout is raised to Bun's maximum because the SSE endpoints stay silent
// while query expansion, retrieval, and model loading happen. Bun's 10s default
// closes the stream mid-request in that gap, which the client sees as a hang
// with no error event.
export default {
  fetch: app.fetch,
  port: 8000,
  idleTimeout: 255,
};
