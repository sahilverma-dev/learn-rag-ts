import { useCallback, useRef, useState } from "react";
import { streamChat, type ApiErrorInfo, type Source } from "../lib/api";

export type MessageRole = "user" | "assistant";

export type Message = {
  id: number;
  role: MessageRole;
  text: string;
  status: "streaming" | "done" | "error";
  sources?: Source[];
  error?: ApiErrorInfo;
};

const nextId = (() => {
  let counter = 0;
  return () => ++counter;
})();

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const updateMessage = useCallback(
    (id: number, patch: Partial<Message> | ((m: Message) => Partial<Message>)) => {
      setMessages((current) =>
        current.map((m) =>
          m.id === id
            ? typeof patch === "function"
              ? { ...m, ...patch(m) }
              : { ...m, ...patch }
            : m,
        ),
      );
    },
    [],
  );

  const send = useCallback(
    (question: string) => {
      const text = question.trim();
      if (!text || busy) return;

      const userMsg: Message = { id: nextId(), role: "user", text, status: "done" };
      const assistantId = nextId();
      const assistantMsg: Message = {
        id: assistantId,
        role: "assistant",
        text: "",
        status: "streaming",
      };

      setMessages((current) => [...current, userMsg, assistantMsg]);
      setBusy(true);
      setError(null);

      const controller = new AbortController();
      abortRef.current = controller;

      streamChat(
        text,
        {
          onStatus: () => {
            /* keep the placeholder sparkline; no special handling needed */
          },
          onSources: (sources) => updateMessage(assistantId, { sources }),
          onToken: (token) =>
            updateMessage(assistantId, (current) =>
              current.text === ""
                ? { text: token }
                : { text: current.text + token },
            ),
          onDone: () => {
            updateMessage(assistantId, { status: "done" });
            setBusy(false);
            abortRef.current = null;
          },
          onError: (info) => {
            updateMessage(assistantId, { status: "error", error: info });
            setBusy(false);
            setError(info.message);
            abortRef.current = null;
          },
        },
        controller.signal,
      ).catch(() => {
        setBusy(false);
        abortRef.current = null;
      });
    },
    [busy, updateMessage],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setMessages([]);
    setBusy(false);
    setError(null);
  }, []);

  return { messages, busy, error, send, reset };
}