import { useState, type KeyboardEvent, type FormEvent } from "react";

export default function PromptBar({
  onSend,
  disabled = false,
  placeholder = "Reply",
}: {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");

  const canSend = draft.trim().length > 0 && !disabled;

  const submit = () => {
    if (!canSend) return;
    onSend(draft.trim());
    setDraft("");
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit();
  };

  return (
    <form onSubmit={onSubmit} className="w-full">
      <div
        className={`relative flex items-end gap-1 border border-line bg-surface p-1.5 shadow-card transition-[border-color] duration-150 focus-within:border-line-strong ${
          draft.trim().length > 0 ? "rounded-[22px]" : "rounded-[14px]"
        }`}
      >
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          rows={1}
          aria-label="Prompt"
          className="min-w-0 w-full resize-none bg-transparent px-2 py-[9px] text-[14px] leading-5 text-ink outline-none placeholder:text-ink-3 [overflow-wrap:anywhere]"
        />
        <button
          type="submit"
          aria-label="Send"
          disabled={!canSend}
          className="flex size-8 shrink-0 items-center justify-center self-end rounded-[10px] transition-[background-color,color,transform] duration-150 enabled:active:scale-[0.94] disabled:cursor-not-allowed"
          style={{
            background: canSend ? "var(--ink)" : "var(--line-strong)",
            color: canSend ? "var(--surface)" : "var(--ink-2)",
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
        </button>
      </div>
    </form>
  );
}