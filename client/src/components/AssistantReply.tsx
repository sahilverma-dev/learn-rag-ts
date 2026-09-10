import { useEffect, useState } from "react";
import type { Message } from "../hooks/useChat";
import LoadingState from "./LoadingState";

/* A word-by-word reveal that plays once the streamed text settles, so the
 * final message rests flush with a blinking caret like the reference. */
function StreamLine({ text }: { text: string }) {
  const words = text.split(/\s+/).filter(Boolean);
  const [n, setN] = useState(0);
  const streaming = n < words.length;

  useEffect(() => {
    if (!streaming) return;
    const t = setTimeout(() => setN((c) => c + 1), 34);
    return () => clearTimeout(t);
  }, [n, streaming]);

  return (
    <p className="max-w-[620px] text-[13.5px] leading-[1.65] text-ink">
      {words.slice(0, n).map((word, i) => (
        <span key={i} className="inline">
          {word}{" "}
        </span>
      ))}
      {streaming && <span className="stream-caret is-streaming" />}
      {!streaming && <span className="stream-caret" />}
    </p>
  );
}

function SourcesPanel({ message }: { message: Message }) {
  const [open, setOpen] = useState(false);
  const sources = message.sources ?? [];
  if (sources.length === 0) return null;

  return (
    <div className="mt-2.5">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex items-center gap-1.5 rounded-[6px] px-1 py-0.5 text-left transition-colors duration-150 hover:bg-hover"
      >
        <span className="flex -space-x-1">
          {sources.slice(0, 3).map((_source, i) => (
            <span
              key={i}
              className="flex size-3.5 items-center justify-center rounded-full bg-accent text-[7px] font-bold text-white shadow-[0_0_0_1.5px_var(--canvas)]"
            >
              {i + 1}
            </span>
          ))}
        </span>
        <span className="text-[12px] text-ink-2">
          {sources.length} {sources.length === 1 ? "source" : "sources"}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`text-ink-3 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      <div
        className="grid transition-[grid-template-rows,opacity] duration-300"
        style={{
          gridTemplateRows: open ? "1fr" : "0fr",
          opacity: open ? 1 : 0,
          transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)",
        }}
      >
        <div className="overflow-hidden">
          <div className="mt-1.5 flex flex-col rounded-[10px] bg-inset p-1 shadow-hairline">
            {sources.map((source, i) => {
              const page = source.metadata?.loc
                ? JSON.parse(String(source.metadata.loc)).pageNumber
                : undefined;
              return (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-[6px] px-1.5 py-1 text-[12px] text-ink-2"
                >
                  <span className="shrink-0 rounded-[4px] bg-accent-tint px-1 py-0.5 text-[9px] font-semibold text-accent-ink">
                    {page ? `p.${page}` : `#${i + 1}`}
                  </span>
                  <span className="line-clamp-2 min-w-0 flex-1">
                    {source.text.slice(0, 160)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* Collapsible reasoning output from local reasoning models (deepseek-r1). */
function ReasoningPanel({ message }: { message: Message }) {
  const [open, setOpen] = useState(false);
  const thinking = (message.thinking ?? "").trim();
  if (!thinking) return null;

  const streaming = message.status === "streaming";
  const words = thinking.split(/\s+/).filter(Boolean).length;

  return (
    <div className="mb-2.5">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex items-center gap-1.5 rounded-[6px] px-1 py-0.5 text-left transition-colors duration-150 hover:bg-hover"
      >
        <span className="flex size-3.5 items-center justify-center rounded-full bg-accent-tint text-accent-ink">
          <svg
            width="9"
            height="9"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M12 3a6 6 0 0 0-3.5 10.9V17h7v-3.1A6 6 0 0 0 12 3Z" />
            <path d="M10 21h4" />
          </svg>
        </span>
        <span className="text-[12px] text-ink-2">
          {streaming ? "Reasoning…" : "Reasoning"}
        </span>
        <span className="text-[11px] text-ink-3">
          {words} {words === 1 ? "word" : "words"}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`text-ink-3 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      <div
        className="grid transition-[grid-template-rows,opacity] duration-300"
        style={{
          gridTemplateRows: open ? "1fr" : "0fr",
          opacity: open ? 1 : 0,
          transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)",
        }}
      >
        <div className="overflow-hidden">
          <div className="mt-1.5 max-h-60 overflow-y-auto whitespace-pre-wrap rounded-[10px] bg-inset p-2.5 text-[12px] leading-[1.6] text-ink-2 shadow-hairline">
            {thinking}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AssistantReply({ message }: { message: Message }) {
  if (message.status === "error" && message.error) {
    const info = message.error;
    const isRateLimit = info.type === "rate_limit";
    const isLocalModel = info.type === "local_model";
    const warm = isRateLimit || isLocalModel;
    const tone = warm ? "var(--orange)" : "var(--red)";

    return (
      <div
        className="mt-1 rounded-[10px] px-3.5 py-2.5 text-[13px]"
        style={{
          animation: "fade-in 200ms ease-out both",
          background: warm ? "var(--orange-tint)" : "var(--red-tint)",
        }}
      >
        <div className="flex items-start gap-2">
          <span
            className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full"
            style={{ background: warm ? "var(--orange-tint)" : "var(--red-tint)", color: tone }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              {isRateLimit ? <path d="M12 6v6l4 2" /> : <path d="M12 8v4M12 16h.01" />}
              {!isRateLimit && <circle cx="12" cy="12" r="9" />}
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-medium" style={{ color: tone }}>
              {isRateLimit
                ? "Rate limited"
                : isLocalModel
                  ? "Local model unavailable"
                  : "Something went wrong"}
            </p>
            <p className="mt-0.5 leading-relaxed" style={{ color: "var(--ink-2)" }}>
              {info.message}
            </p>
            {isRateLimit && (
              <p className="mt-1 text-[12px]" style={{ color: "var(--ink-3)" }}>
                {info.retryAfter ? `Try again in about ${Math.ceil(info.retryAfter)}s. ` : ""}Your
                quota resets daily.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  const hasReasoning = Boolean((message.thinking ?? "").trim());

  return (
    <>
      {/* thinking state until the first token lands */}
      {message.status === "streaming" && !message.text && !hasReasoning && (
        <div
          className="flex min-h-6 items-center"
          style={{ animation: "fade-in 200ms ease-out both" }}
        >
          <LoadingState label={message.statusText ?? "Thinking"} variant="Dots" />
        </div>
      )}

      <ReasoningPanel message={message} />

      {message.text && (
        <div style={{ animation: "fade-up 450ms cubic-bezier(0.23,1,0.32,1) both" }}>
          <StreamLine text={message.text} />
          {message.status === "done" && <SourcesPanel message={message} />}
        </div>
      )}
    </>
  );
}