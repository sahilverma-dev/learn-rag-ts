import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import {
  llm,
  GENERATE_RESPONSE_PROMPT,
  generateQueries,
  retrieveAndDedupe,
  buildResponsePromptContext,
} from "./db/rag-helpers";

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
    return c.json({ error: "Missing or empty 'question' query parameter." }, 400);
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

      // 3. Stream the LLM answer token-by-token
      const { contextText } = await buildResponsePromptContext(question, uniqueDocs);
      const responseChain = GENERATE_RESPONSE_PROMPT.pipe(llm);

      const tokenStream = await responseChain.stream({
        question,
        context: contextText,
      });

      for await (const chunk of tokenStream) {
        const content = chunk.content;
        if (typeof content === "string") {
          await stream.writeSSE({ event: "token", data: content });
        } else {
          // Multi-modal content - serialize best-effort
          await stream.writeSSE({
            event: "token",
            data: JSON.stringify(content),
          });
        }
      }

      await stream.writeSSE({ event: "done", data: "" });
    },
    async (e, stream) => {
      await stream.writeSSE({
        event: "error",
        data: e instanceof Error ? e.message : String(e),
      });
    },
  );
});

// Bun auto-detects the Hono default export and starts the HTTP server.
// Port is read from the PORT env var (set to 3001 in .env).
export default app;