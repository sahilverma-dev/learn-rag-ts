/**
 * Minimal Ollama HTTP client for models running on the local network.
 *
 * Configured entirely through env vars so the same code works against any
 * Ollama host:
 *   OLLAMA_BASE_URL        default http://jarvis:11434
 *   OLLAMA_EMBEDDING_MODEL default mxbai-embed-large
 *   OLLAMA_LLM_MODEL       default deepseek-r1:1.5b
 *   OLLAMA_TIMEOUT_MS      default 120000
 */

export const OLLAMA_BASE_URL = (
  process.env.OLLAMA_BASE_URL ?? "http://jarvis:11434"
).replace(/\/+$/, "");

export const OLLAMA_EMBEDDING_MODEL =
  process.env.OLLAMA_EMBEDDING_MODEL ?? "mxbai-embed-large:latest";

export const OLLAMA_LLM_MODEL =
  process.env.OLLAMA_LLM_MODEL ?? "deepseek-r1:1.5b";

const DEFAULT_TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS ?? 120_000);

export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface OllamaStreamChunk {
  content: string;
  thinking: string;
  done: boolean;
}

export class OllamaError extends Error {
  readonly status: number | null;
  readonly model: string | null;

  constructor(
    message: string,
    options: {
      status?: number | null;
      model?: string | null;
      cause?: unknown;
    } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "OllamaError";
    this.status = options.status ?? null;
    this.model = options.model ?? null;
  }
}

export function describeConnectionFailure(err: unknown): string {
  const reason = err instanceof Error ? err.message : String(err);
  return (
    `Could not reach Ollama at ${OLLAMA_BASE_URL} (${reason}). ` +
    `Make sure Ollama is running on that host and accepting LAN connections, ` +
    `e.g. OLLAMA_HOST=0.0.0.0:11434 ollama serve. ` +
    `Verify with: curl ${OLLAMA_BASE_URL}/api/tags`
  );
}

async function postJson(
  path: string,
  body: unknown,
  options: { model: string; timeoutMs?: number; retries?: number },
): Promise<Response> {
  const maxRetries = options.retries ?? 3;
  let lastErr: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(`${OLLAMA_BASE_URL}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new OllamaError(
          `Ollama request ${path} failed with ${response.status} for model "${options.model}": ${detail.slice(0, 300)}`,
          { status: response.status, model: options.model },
        );
      }

      return response;
    } catch (err) {
      lastErr = err;
      if (err instanceof OllamaError && err.status !== null) {
        throw err; // Non-transient HTTP status errors shouldn't be retried blindly
      }
      if (attempt < maxRetries) {
        const delayMs = Math.pow(2, attempt - 1) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  throw new OllamaError(describeConnectionFailure(lastErr), {
    model: options.model,
    cause: lastErr,
  });
}

export async function checkOllamaHealth(timeoutMs = 5_000): Promise<{
  reachable: boolean;
  models: string[];
  embeddingModel: string;
  llmModel: string;
  embeddingModelAvailable: boolean;
  llmModelAvailable: boolean;
  error?: string;
}> {
  try {
    const models = await listOllamaModels(timeoutMs);
    return {
      reachable: true,
      models,
      embeddingModel: OLLAMA_EMBEDDING_MODEL,
      llmModel: OLLAMA_LLM_MODEL,
      embeddingModelAvailable: models.includes(OLLAMA_EMBEDDING_MODEL),
      llmModelAvailable: models.includes(OLLAMA_LLM_MODEL),
    };
  } catch (err) {
    return {
      reachable: false,
      models: [],
      embeddingModel: OLLAMA_EMBEDDING_MODEL,
      llmModel: OLLAMA_LLM_MODEL,
      embeddingModelAvailable: false,
      llmModelAvailable: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function listOllamaModels(timeoutMs = 5_000): Promise<string[]> {
  let response: Response;
  try {
    response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    throw new OllamaError(describeConnectionFailure(err), { cause: err });
  }

  if (!response.ok) {
    throw new OllamaError(`Ollama /api/tags failed with ${response.status}.`, {
      status: response.status,
    });
  }

  const data = (await response.json()) as {
    models?: Array<{ name?: string; model?: string }>;
  };
  return (data.models ?? [])
    .map((entry) => entry.name ?? entry.model)
    .filter((name): name is string => Boolean(name));
}

export async function embedWithOllama(
  input: string | string[],
  options: { model?: string; timeoutMs?: number } = {},
): Promise<number[][]> {
  const model = options.model ?? OLLAMA_EMBEDDING_MODEL;
  const inputs = Array.isArray(input) ? input : [input];

  if (inputs.length === 0) return [];

  const response = await postJson(
    "/api/embed",
    { model, input: inputs },
    { model, timeoutMs: options.timeoutMs },
  );

  const data = (await response.json()) as { embeddings?: number[][] };
  const embeddings = data.embeddings ?? [];

  if (embeddings.length !== inputs.length) {
    throw new OllamaError(
      `Ollama returned ${embeddings.length} embeddings for ${inputs.length} inputs (model "${model}").`,
      { model },
    );
  }
  if (
    embeddings.some((vector) => !Array.isArray(vector) || vector.length === 0)
  ) {
    throw new OllamaError(
      `Ollama returned an empty embedding vector for model "${model}".`,
      { model },
    );
  }

  return embeddings;
}

/**
 * Embeds a throwaway string to learn the model's vector size. Used instead of
 * hardcoding dimensions so the Pinecone index always matches the model.
 */
export async function probeEmbeddingDimension(
  model = OLLAMA_EMBEDDING_MODEL,
  timeoutMs = 30_000,
): Promise<number> {
  const [vector] = await embedWithOllama("dimension probe", {
    model,
    timeoutMs,
  });
  if (!vector?.length) {
    throw new OllamaError(
      `Could not determine the embedding dimension for "${model}".`,
      { model },
    );
  }
  return vector.length;
}

export async function chatWithOllama(
  messages: ChatMessage[],
  options: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    timeoutMs?: number;
  } = {},
): Promise<{ content: string; thinking: string }> {
  const model = options.model ?? OLLAMA_LLM_MODEL;

  const response = await postJson(
    "/api/chat",
    {
      model,
      messages,
      stream: false,
      options: {
        temperature: options.temperature ?? 0,
        ...(options.maxTokens ? { num_predict: options.maxTokens } : {}),
      },
    },
    { model, timeoutMs: options.timeoutMs },
  );

  const data = (await response.json()) as {
    message?: { content?: string; thinking?: string };
  };

  return {
    content: data.message?.content ?? "",
    thinking: data.message?.thinking ?? "",
  };
}

/**
 * Parses one NDJSON line from Ollama's streaming /api/chat response. Returns
 * null for blank/keepalive lines. Throws when the line carries an error.
 */
export function parseOllamaStreamLine(line: string): OllamaStreamChunk | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  let payload: any;
  try {
    payload = JSON.parse(trimmed);
  } catch {
    return null;
  }

  if (payload?.error) {
    throw new OllamaError(String(payload.error));
  }

  const message = payload?.message ?? {};
  return {
    content: typeof message.content === "string" ? message.content : "",
    thinking: typeof message.thinking === "string" ? message.thinking : "",
    done: Boolean(payload?.done),
  };
}

export async function* streamChatWithOllama(
  messages: ChatMessage[],
  options: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    timeoutMs?: number;
  } = {},
): AsyncGenerator<OllamaStreamChunk> {
  const model = options.model ?? OLLAMA_LLM_MODEL;

  const response = await postJson(
    "/api/chat",
    {
      model,
      messages,
      stream: true,
      options: {
        temperature: options.temperature ?? 0,
        ...(options.maxTokens ? { num_predict: options.maxTokens } : {}),
      },
    },
    { model, timeoutMs: options.timeoutMs },
  );

  if (!response.body) {
    throw new OllamaError(
      "Ollama returned a streaming response with no body.",
      {
        model,
      },
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let newline: number;
      while ((newline = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        const chunk = parseOllamaStreamLine(line);
        if (chunk) yield chunk;
      }
    }

    const trailing = parseOllamaStreamLine(buffer);
    if (trailing) yield trailing;
  } finally {
    await reader.cancel().catch(() => {});
  }
}

/** Removes inline reasoning blocks from a completed model response. */
export function stripThinking(content: string): string {
  let output = content.replace(/<\s*think\s*>[\s\S]*?<\s*\/\s*think\s*>/gi, "");
  const unclosed = output.search(/<\s*think\s*>/i);
  if (unclosed !== -1) output = output.slice(0, unclosed);
  return output.trim();
}

const THINK_OPEN = "<think>";
const THINK_CLOSE = "</think>";

/**
 * Splits a token stream into visible answer text and reasoning text, buffering
 * the tail so a reasoning tag split across chunks is still caught.
 */
export class ThinkTagFilter {
  private buffer = "";
  private insideThink = false;

  push(chunk: string): { answer: string; thinking: string } {
    this.buffer += chunk;
    let answer = "";
    let thinking = "";

    while (this.buffer.length > 0) {
      if (this.insideThink) {
        const close = this.buffer.indexOf(THINK_CLOSE);
        if (close === -1) {
          const keep = Math.max(0, this.buffer.length - THINK_CLOSE.length);
          thinking += this.buffer.slice(0, keep);
          this.buffer = this.buffer.slice(keep);
          break;
        }
        thinking += this.buffer.slice(0, close);
        this.buffer = this.buffer.slice(close + THINK_CLOSE.length);
        this.insideThink = false;
      } else {
        const open = this.buffer.indexOf(THINK_OPEN);
        if (open === -1) {
          const keep = Math.max(0, this.buffer.length - THINK_OPEN.length);
          answer += this.buffer.slice(0, keep);
          this.buffer = this.buffer.slice(keep);
          break;
        }
        answer += this.buffer.slice(0, open);
        this.buffer = this.buffer.slice(open + THINK_OPEN.length);
        this.insideThink = true;
      }
    }

    return { answer, thinking };
  }

  flush(): { answer: string; thinking: string } {
    const rest = this.buffer;
    this.buffer = "";
    return this.insideThink
      ? { answer: "", thinking: rest }
      : { answer: rest, thinking: "" };
  }
}
