import { useState } from "react";
import type { LocalModelState } from "../hooks/useLocalHealth";
import { TONE_COLOR, TONE_TINT } from "../lib/localModelTone";

/** Compact indicator for whether the local Ollama models and index are ready. */
export default function LocalModelStatus({
  state,
  onRefresh,
  compact = false,
}: {
  state: LocalModelState;
  onRefresh?: () => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const color = TONE_COLOR[state.tone];
  const tint = TONE_TINT[state.tone];

  const dot = (
    <span
      aria-hidden
      className="size-2 shrink-0 rounded-full"
      style={{
        background: color,
        animation:
          state.tone === "loading"
            ? "pixel-on 900ms ease-in-out infinite"
            : undefined,
      }}
    />
  );

  if (compact) {
    return (
      <div
        title={`${state.label}${state.detail ? ` — ${state.detail}` : ""}`}
        className="flex size-9 items-center justify-center rounded-[8px]"
        style={{ background: tint }}
      >
        {dot}
      </div>
    );
  }

  const actionable = state.tone === "warning" || state.tone === "error";

  return (
    <div>
      <button
        type="button"
        aria-expanded={actionable ? open : undefined}
        onClick={() => actionable && setOpen((current) => !current)}
        className="flex w-full items-center gap-2 rounded-[8px] px-2 py-1.5 text-left transition-colors duration-150 hover:bg-hover"
      >
        {dot}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12.5px] font-medium text-ink-2">
            {state.label}
          </span>
          <span className="block text-[11px] text-ink-3">Local models</span>
        </span>
      </button>

      {actionable && (
        <div
          className="grid transition-[grid-template-rows,opacity] duration-300"
          style={{
            gridTemplateRows: open ? "1fr" : "0fr",
            opacity: open ? 1 : 0,
            transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)",
          }}
        >
          <div className="overflow-hidden">
            <div
              className="mx-1 mt-1 rounded-[8px] p-2 text-[11.5px] leading-relaxed"
              style={{ background: tint, color: "var(--ink-2)" }}
            >
              {state.detail}
              {onRefresh && (
                <button
                  type="button"
                  onClick={onRefresh}
                  className="mt-1.5 block font-medium underline underline-offset-2"
                  style={{ color }}
                >
                  Re-check
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
