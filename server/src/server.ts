import { serve } from "@hono/node-server";

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

const app = new Hono();

// CORS restricted to the local frontend origin
app.use("/chat/*", cors({ origin: "http://localhost:3000" }));

app.get("/", (c) => c.json({ ok: true }));

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

  return streamSSE(
    c,
    async (stream) => {
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
    },
    async (e, stream) => {
      // Give the client structured info about the failure, including how long
      // to wait when the provider is rate-limited.
      if (e instanceof LLMRateLimitError) {
        await stream.writeSSE({
          event: "error",
          data: JSON.stringify({
            type: "rate_limit",
            message: e.message,
            retryAfter: e.retryAfterSeconds,
          }),
        });
        return;
      }
      await stream.writeSSE({
        event: "error",
        data: JSON.stringify({
          type: "error",
          message: e instanceof Error ? e.message : String(e),
        }),
      });
    },
  );
});

// Bun auto-detects the Hono default export and starts the HTTP server.
// Port is read from the PORT env var (set to 3001 in .env).
serve({
  fetch: app.fetch,
  port: 8000,
});
