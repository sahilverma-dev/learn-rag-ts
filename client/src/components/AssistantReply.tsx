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

export default function AssistantReply({ message }: { message: Message }) {
  if (message.status === "error") {
    return (
      <div
        className="mt-1 rounded-[10px] bg-red-tint px-3.5 py-2.5 text-[13px] text-red"
        style={{ animation: "fade-in 200ms ease-out both" }}
      >
        {message.error ?? "Something went wrong. Please try again."}
      </div>
    );
  }

  return (
    <>
      {/* thinking state until the first token lands */}
      {message.status === "streaming" && !message.text && (
        <div
          className="flex min-h-6 items-center"
          style={{ animation: "fade-in 200ms ease-out both" }}
        >
          <LoadingState label="Thinking" variant="Dots" />
        </div>
      )}

      {message.text && (
        <div style={{ animation: "fade-up 450ms cubic-bezier(0.23,1,0.32,1) both" }}>
          <StreamLine text={message.text} />
          {message.status === "done" && <SourcesPanel message={message} />}
        </div>
      )}
    </>
  );
}