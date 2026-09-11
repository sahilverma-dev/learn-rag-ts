import { useEffect, useRef, useState } from "react";
import { useChat } from "../hooks/useChat";
import { describeLocalModelState, useLocalHealth } from "../hooks/useLocalHealth";
import SidebarNav from "./SidebarNav";
import LocalModelStatus from "./LocalModelStatus";
import PromptBar from "./PromptBar";
import UserBubble from "./UserBubble";
import AssistantReply from "./AssistantReply";
import EmptyState from "./EmptyState";

export default function ChatShell() {
  const { messages, busy, send, reset } = useChat();
  const { health, loading, error, refresh } = useLocalHealth();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const modelState = describeLocalModelState(health, loading, error);

  const active = messages.length > 0;
  const lastTitle = title;

  /* keep a stable title from the first user message */
  useEffect(() => {
    if (title !== null) return;
    const firstUser = messages.find((m) => m.role === "user");
    if (firstUser) setTitle(firstUser.text.slice(0, 40));
  }, [messages, title]);

  /* auto-scroll to the bottom smoothly as content streams unless user scrolls up */
  useEffect(() => {
    if (!active) return;
    const el = scrollRef.current;
    if (!el) return;

    // Check if user is scrolled near bottom (within 120px)
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (isNearBottom) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [messages, active]);

  const newChat = () => {
    reset();
    setTitle(null);
    setMobileSidebarOpen(false);
  };

  const pickRecent = (label: string) => {
    newChat();
    void label;
  };

  return (
    <main className="relative flex h-[100dvh] gap-0 bg-canvas p-2.5 text-ink">
      {/* Desktop sidebar */}
      <div className="hidden h-full lg:block">
        <SidebarNav
          activeTitle={lastTitle}
          onNewChat={newChat}
          onPickRecent={pickRecent}
          renderModelStatus={(compact) => (
            <LocalModelStatus
              state={modelState}
              onRefresh={() => void refresh()}
              compact={compact}
            />
          )}
        />
      </div>

      {/* Mobile sidebar overlay & drawer */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}
      <div
        className={`fixed inset-y-0 left-0 z-50 transform bg-canvas p-2.5 transition-transform duration-200 ease-out lg:hidden ${
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <SidebarNav
          activeTitle={lastTitle}
          onNewChat={newChat}
          onPickRecent={pickRecent}
          onCloseMobile={() => setMobileSidebarOpen(false)}
          renderModelStatus={(compact) => (
            <LocalModelStatus
              state={modelState}
              onRefresh={() => void refresh()}
              compact={compact}
            />
          )}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        {/* Mobile header bar with sidebar toggle */}
        <div className="flex h-9 items-center justify-between px-1 lg:hidden">
          <button
            type="button"
            aria-label="Open sidebar"
            onClick={() => setMobileSidebarOpen(true)}
            className="flex size-8 items-center justify-center rounded-[8px] border border-line bg-surface text-ink-3 shadow-btn transition-colors hover:text-ink"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <path d="M9 3v18" />
            </svg>
          </button>
          <span className="text-[13px] font-medium text-ink">
            {lastTitle ?? "RAG Chat"}
          </span>
          <div className="w-8" />
        </div>

        {/* main chat pane */}
        <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-[14px] border border-line bg-page">
          {active ? (
            <div className="relative flex min-h-0 flex-1 flex-col">
              <div
                ref={scrollRef}
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
              >
                <div className="flex flex-col gap-8 px-4 pb-28 pt-8 sm:px-8 lg:px-12">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className="mx-auto w-full max-w-[720px]"
                    >
                      {message.role === "user" ? (
                        <UserBubble text={message.text} />
                      ) : (
                        <AssistantReply message={message} />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* floating composer */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-page via-page/90 to-transparent px-4 pb-6 pt-4 sm:px-8 lg:px-12">
                <div className="mx-auto max-w-[720px]">
                  <PromptBar
                    placeholder="Reply"
                    onSend={send}
                    disabled={busy}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto">
              <EmptyState onSend={send} />
            </div>
          )}
        </section>
      </div>
    </main>
  );
}