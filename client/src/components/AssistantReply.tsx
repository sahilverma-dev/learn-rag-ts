import { useEffect, useState, type ReactNode } from "react";
import type { Message } from "../hooks/useChat";
import { tokenize } from "../lib/streamTokens";
import {
  sourceArticle,
  sourceLabel,
  sourcePage,
  sourceTitle,
} from "../lib/sources";
import LoadingState from "./LoadingState";
import Markdown from "./Markdown";
import ContextCards, { type ContextChunk } from "./ui/context-cards";

const ACTION_ICONS: ReactNode[] = [
  <g key="copy">
    <rect x="9" y="9" width="12" height="12" rx="2.5" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </g>,
  <path key="retry" d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" />,
  <path
    key="up"
    d="M7 10v12M15 5.88L14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88z"
  />,
  <path
    key="down"
    d="M17 14V2M9 18.12L10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88z"
  />,
];

/* Token/word reveal streaming text component matching StreamText / StreamingText primitive */
function StreamText({
  text,
  streaming,
  sources = [],
}: {
  text: string;
  streaming: boolean;
  sources?: Message["sources"];
}) {
  const tokens = tokenize(text);
  const total = tokens.length;
  const [revealed, setRevealed] = useState(0);
  const [sourcesOpen, setSourcesOpen] = useState(false);

  const done = !streaming && revealed >= total;

  useEffect(() => {
    if (revealed >= total) return;
    const delay = streaming ? 25 : 5;
    const t = setTimeout(
      () => setRevealed((current) => Math.min(current + 1, total)),
      delay,
    );
    return () => clearTimeout(t);
  }, [revealed, total, streaming]);

  const chunks: ContextChunk[] = (sources ?? []).map((source, i) => {
    const page = sourcePage(source.metadata);
    const label = sourceLabel(source.metadata);
    const article = sourceArticle(source.metadata);
    const title = sourceTitle(source.metadata);

    const displayTitle =
      [article, title].filter(Boolean).join(" — ") ||
      `Retrieved Chunk #${i + 1}`;
    const chars = `${source.text.length.toLocaleString()} characters`;
    const sourceDoc =
      [label, page ? `p.${page}` : null].filter(Boolean).join(" ") ||
      `Source ${i + 1}`;

    const badge = (label || "TXT").slice(0, 4).toUpperCase();
    const tones = ["bg-accent", "bg-green", "bg-orange", "bg-red"];
    const tone = tones[i % tones.length];

    return {
      title: displayTitle,
      chars,
      body: source.text,
      source: sourceDoc,
      badge,
      tone,
    };
  });

  return (
    <div className="w-full">
      {/* Streamed content */}
      <div className={`md-body${done ? " is-done" : ""}`}>
        <Markdown>{tokens.slice(0, revealed).join("")}</Markdown>
      </div>

      {/* Action icons + sources bar once streaming finishes */}
      <div
        className="mt-3 flex flex-wrap items-center gap-1 transition-opacity duration-300"
        style={{ opacity: done ? 1 : 0, pointerEvents: done ? "auto" : "none" }}
      >
        {ACTION_ICONS.map((icon, i) => (
          <button
            key={i}
            type="button"
            aria-label="Action"
            className="flex size-7 items-center justify-center rounded-[6px] text-ink-3 transition-colors duration-100 hover:bg-hover-2 hover:text-ink-2"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {icon}
            </svg>
          </button>
        ))}

        {sources.length > 0 && (
          <button
            type="button"
            aria-expanded={sourcesOpen}
            onClick={() => setSourcesOpen((current) => !current)}
            className="ml-1 flex items-center gap-1.5 rounded-[6px] px-2 py-1 text-left transition-colors duration-150 hover:bg-hover"
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
            <span className="text-[12px] font-medium text-ink-2">
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
              className={`text-ink-3 transition-transform duration-150 ${sourcesOpen ? "rotate-180" : ""}`}
              aria-hidden
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        )}
      </div>

      {/* Expanded Context Cards drawer */}
      {sources.length > 0 && (
        <div
          className="grid transition-[grid-template-rows,opacity] duration-300"
          style={{
            gridTemplateRows: done && sourcesOpen ? "1fr" : "0fr",
            opacity: done && sourcesOpen ? 1 : 0,
            transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)",
          }}
        >
          <div className="overflow-hidden">
            <div className="mt-2 pt-1">
              <ContextCards
                chunks={chunks}
                labels={{
                  header: "Retrieved Context",
                  count: String(sources.length),
                }}
                className="max-w-full"
              />
            </div>
          </div>
        </div>
      )}
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
            style={{
              background: warm ? "var(--orange-tint)" : "var(--red-tint)",
              color: tone,
            }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              {isRateLimit ? (
                <path d="M12 6v6l4 2" />
              ) : (
                <path d="M12 8v4M12 16h.01" />
              )}
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
            <p
              className="mt-0.5 leading-relaxed"
              style={{ color: "var(--ink-2)" }}
            >
              {info.message}
            </p>
            {isRateLimit && (
              <p className="mt-1 text-[12px]" style={{ color: "var(--ink-3)" }}>
                {info.retryAfter
                  ? `Try again in about ${Math.ceil(info.retryAfter)}s. `
                  : ""}
                Your quota resets daily.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  const hasReasoning = Boolean((message.thinking ?? "").trim());

  return (
    <article
      className="flex gap-3"
      style={{ animation: "fade-up 450ms cubic-bezier(0.23,1,0.32,1) both" }}
    >
      {/* <Spark className="mt-0.5" />
      <img
        // src="https://thumb.wikimedia.org/wikipedia/en/thumb/4/41/Flag_of_India.svg/1920px-Flag_of_India.svg.png?utm_source=en.wikipedia.org&utm_campaign=index&utm_content=thumbnail&_=20240827082344"
        src="https://vectorflags.s3.amazonaws.com/flags/in-square-01.png"
        alt="india flag"
        className="size-7 aspect-square object-cover rounded-sm border-[0.5px] border-ink-3"
      /> */}
      <div className="min-w-0 flex-1">
        {/* <span className="mb-2 block text-[11px] font-medium uppercase tracking-[0.09em] text-ink-3">
          Indian Constitution - RAG Assistant
        </span> */}

        {/* thinking state until the first token lands */}
        {message.status === "streaming" && !message.text && !hasReasoning && (
          <div
            className="flex min-h-6 items-center"
            style={{ animation: "fade-in 200ms ease-out both" }}
          >
            <LoadingState
              label={message.statusText ?? "Thinking"}
              variant="Dots"
            />
          </div>
        )}

        <ReasoningPanel message={message} />

        {message.text && (
          <StreamText
            text={message.text}
            streaming={message.status === "streaming"}
            sources={message.sources}
          />
        )}
      </div>
    </article>
  );
}
