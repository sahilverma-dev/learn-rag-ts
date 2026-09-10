export const API_BASE_URL = "http://localhost:8000";
// (import.meta.env?.VITE_API_BASE_URL as string | undefined) ??
// "http://localhost:8000";

export type Source = {
  metadata?: Record<string, unknown>;
  text: string;
};

export type ApiErrorInfo = {
  message: string;
  /** "rate_limit" | "error" */
  type?: string;
  /** seconds to wait before retrying, when rate-limited */
  retryAfter?: number | null;
};

/** Normalize a possibly-structured SSE error payload into a plain object. */
function parseErrorData(data: string): ApiErrorInfo {
  try {
    const parsed = JSON.parse(data) as Partial<
      ApiErrorInfo & { message?: unknown }
    >;
    if (parsed && typeof parsed === "object") {
      return {
        message: String(parsed.message ?? data),
        type: parsed.type ?? "error",
        retryAfter: parsed.retryAfter ?? null,
      };
    }
  } catch {
    /* not JSON — treat as a bare message */
  }
  return { message: data, type: "error", retryAfter: null };
}

export type StreamHandlers = {
  onStatus?: (status: string) => void;
  onSources?: (sources: Source[]) => void;
  onToken?: (token: string) => void;
  /** Reasoning output from local reasoning models (e.g. deepseek-r1). */
  onThinking?: (thinking: string) => void;
  onDone?: () => void;
  onError?: (info: ApiErrorInfo) => void;
};

/** Incrementally parse an SSE byte/buffer stream framed by the Hono helper. */
async function readSSE(
  response: Response,
  handlers: StreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  if (!response.body) {
    handlers.onError?.({
      type: "error",
      message: "The response has no readable body.",
      retryAfter: null,
    });
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let event = "message";
  let data = "";

  const dispatch = () => {
    if (event === "status") handlers.onStatus?.(data);
    else if (event === "error") handlers.onError?.(parseErrorData(data));
    else if (event === "sources") {
      try {
        handlers.onSources?.(JSON.parse(data) as Source[]);
      } catch {
        handlers.onSources?.([]);
      }
    } else if (event === "token") handlers.onToken?.(data);
    else if (event === "thinking") handlers.onThinking?.(data);
    else if (event === "done") handlers.onDone?.();
    else if (data) handlers.onToken?.(data); // bare data frames fall back to tokens
    event = "message";
    data = "";
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary: number;
    while ((boundary = buffer.indexOf("\n\n")) !== -1) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      for (const line of block.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) {
          const payload = line.startsWith("data: ")
            ? line.slice(6)
            : line.slice(5);
          data = data ? `${data}\n${payload}` : payload;
        }
      }
      dispatch();
    }
  }

  // flush any trailing frame
  if (data) dispatch();
  void signal;
}

/** Stream a chat question from a RAG endpoint, calling handlers as events arrive. */
async function streamFromEndpoint(
  endpoint: string,
  question: string,
  handlers: StreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const url = new URL(`${API_BASE_URL}${endpoint}`);
  url.searchParams.set("question", question);

  let response: Response;
  try {
    response = await fetch(url.toString(), { signal });
  } catch (err) {
    handlers.onError?.({
      type: "network",
      message:
        err instanceof Error
          ? `Could not reach the server: ${err.message}`
          : "Could not reach the server.",
      retryAfter: null,
    });
    return;
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      if (body?.error) message = body.error;
    } catch {
      /* keep default message */
    }
    handlers.onError?.({ type: "http", message, retryAfter: null });
    return;
  }

  await readSSE(response, handlers, signal);
}

/** Streams from `/chat`, the hosted-provider RAG pipeline. */
export async function streamChat(
  question: string,
  handlers: StreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  return streamFromEndpoint("/chat", question, handlers, signal);
}

/** Streams from `/local/chat`, the local-network Ollama RAG pipeline. */
export async function streamLocalChat(
  question: string,
  handlers: StreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  return streamFromEndpoint("/local/chat", question, handlers, signal);
}

export type LocalHealth = {
  ok: boolean;
  ollama: {
    reachable: boolean;
    models: string[];
    embeddingModel: string;
    llmModel: string;
    embeddingModelAvailable: boolean;
    llmModelAvailable: boolean;
    error?: string;
  };
  index: {
    exists: boolean;
    dimension: number | null;
    recordCount: number;
    namespaces: string[];
    name: string;
  } | null;
  indexError: string | null;
  llmModel: string;
};

/** Checks whether the local Ollama models and vector index are ready. */
export async function fetchLocalHealth(
  signal?: AbortSignal,
): Promise<LocalHealth> {
  const response = await fetch(`${API_BASE_URL}/local/health`, { signal });
  if (!response.ok) {
    throw new Error(`Health check failed (${response.status})`);
  }
  return (await response.json()) as LocalHealth;
}
