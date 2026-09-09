export const API_BASE_URL =
  (import.meta.env?.VITE_API_BASE_URL as string | undefined) ??
  "http://localhost:3001";

export type Source = {
  metadata?: Record<string, unknown>;
  text: string;
};

export type StreamHandlers = {
  onStatus?: (status: string) => void;
  onSources?: (sources: Source[]) => void;
  onToken?: (token: string) => void;
  onDone?: () => void;
  onError?: (message: string) => void;
};

/** Incrementally parse an SSE byte/buffer stream framed by the Hono helper. */
async function readSSE(
  response: Response,
  handlers: StreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  if (!response.body) {
    handlers.onError?.("The response has no readable body.");
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let event = "message";
  let data = "";

  const dispatch = () => {
    if (event === "status") handlers.onStatus?.(data);
    else if (event === "sources") {
      try {
        handlers.onSources?.(JSON.parse(data) as Source[]);
      } catch {
        handlers.onSources?.([]);
      }
    } else if (event === "token") handlers.onToken?.(data);
    else if (event === "done") handlers.onDone?.();
    else if (event === "error") handlers.onError?.(data);
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
          const payload = line.slice(5).trim();
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

/** Stream a chat question from the RAG server, calling handlers as events arrive. */
export async function streamChat(
  question: string,
  handlers: StreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const url = new URL(`${API_BASE_URL}/chat`);
  url.searchParams.set("question", question);

  let response: Response;
  try {
    response = await fetch(url.toString(), { signal });
  } catch (err) {
    handlers.onError?.(
      err instanceof Error
        ? `Could not reach the server: ${err.message}`
        : "Could not reach the server.",
    );
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
    handlers.onError?.(message);
    return;
  }

  await readSSE(response, handlers, signal);
}