import { useEffect, useState, type CSSProperties } from "react";
import type { LocalModelTone } from "../hooks/useLocalHealth";
import { TONE_COLOR } from "../lib/localModelTone";
import PromptBar from "./PromptBar";

const SUGGESTIONS = [
  "What are the punishments for offences under Chapter II?",
  "What is the punishment for theft?",
  "Who is the author of the BNS?",
  "What offences are defined as punishable under the Sanhita?",
];

const TIMING = {
  hello: 170,
  question: 330,
  prompt: 400,
  recommendations: 550,
};

function revealStyle(visible: boolean): CSSProperties {
  if (visible) {
    return { opacity: 1, transform: "translate3d(0,0,0)", filter: "blur(0px)" };
  }
  return {
    opacity: 0,
    transform: "translate3d(0, 23px, 0)",
    filter: "blur(17px)",
  };
}

export default function EmptyState({
  onSend,
  modelStatus,
}: {
  onSend: (text: string) => void;
  modelStatus?: { label: string; tone: LocalModelTone; detail?: string };
}) {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setStage(1), TIMING.hello),
      setTimeout(() => setStage(2), TIMING.question),
      setTimeout(() => setStage(3), TIMING.prompt),
      setTimeout(() => setStage(4), TIMING.recommendations),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  const transition =
    "opacity 800ms cubic-bezier(0.16,1,0.3,1), transform 800ms cubic-bezier(0.16,1,0.3,1), filter 800ms cubic-bezier(0.16,1,0.3,1)";

  return (
    <div className="mx-auto flex min-h-full max-w-[720px] flex-col justify-center px-4 py-10 sm:px-8">
      <h1 className="text-[26px] font-normal tracking-[-0.02em] text-ink">
        <span
          className="block text-ink-3"
          style={{ ...revealStyle(stage >= 1), transition }}
        >
          Hello
        </span>
        <span className="block" style={{ ...revealStyle(stage >= 2), transition }}>
          What can I help you with?
        </span>
      </h1>

      <div
        className="mt-7"
        style={{ ...revealStyle(stage >= 3), transition }}
      >
        <PromptBar
          placeholder="Ask anything about the Bharatiya Nyaya Sanhita…"
          onSend={onSend}
        />
      </div>

      {modelStatus && (
        <div
          className="mt-3 flex items-center gap-1.5"
          style={{ ...revealStyle(stage >= 3), transition }}
        >
          <span
            aria-hidden
            className="size-2 shrink-0 rounded-full"
            style={{ background: TONE_COLOR[modelStatus.tone] }}
          />
          <span className="text-[12px] text-ink-3">
            {modelStatus.label}
            {modelStatus.detail ? ` · ${modelStatus.detail}` : ""}
          </span>
        </div>
      )}

      <div
        className="mt-6 flex flex-col"
        style={{ ...revealStyle(stage >= 4), transition }}
      >
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => onSend(suggestion)}
            className="-mx-2 flex items-center gap-3 rounded-[9px] px-2 py-2.5 text-left text-[14px] text-ink transition-colors duration-150 hover:bg-hover"
          >
            <span className="flex size-5 shrink-0 items-center justify-center rounded-[6px] bg-accent-tint text-accent-ink">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </span>
            <span className="min-w-0 flex-1 truncate">{suggestion}</span>
          </button>
        ))}
      </div>
    </div>
  );
}