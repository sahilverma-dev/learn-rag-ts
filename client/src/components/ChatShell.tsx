import { useEffect, useRef, useState } from "react";
import { useChat } from "../hooks/useChat";
import SidebarNav from "./SidebarNav";
import PromptBar from "./PromptBar";
import UserBubble from "./UserBubble";
import AssistantReply from "./AssistantReply";
import EmptyState from "./EmptyState";

export default function ChatShell() {
  const { messages, busy, send, reset } = useChat();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState<string | null>(null);

  const active = messages.length > 0;
  const lastTitle = title;

  /* keep a stable title from the first user message */
  useEffect(() => {
    if (title !== null) return;
    const firstUser = messages.find((m) => m.role === "user");
    if (firstUser) setTitle(firstUser.text.slice(0, 40));
  }, [messages, title]);

  /* auto-scroll to the bottom as content streams */
  useEffect(() => {
    if (!active) return;
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, active]);

  const newChat = () => {
    reset();
    setTitle(null);
  };

  const pickRecent = () => newChat();

  return (
    <main className="flex h-[100dvh] gap-0 bg-canvas p-2.5 text-ink lg:pl-0">
      <div className="hidden h-full lg:block">
        <SidebarNav
          activeTitle={lastTitle}
          onNewChat={newChat}
          onPickRecent={pickRecent}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        {/* main chat pane */}
        <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-[14px] border border-line bg-page">
          {active ? (
            <div className="relative flex min-h-0 flex-1 flex-col">
              <div
                ref={scrollRef}
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
              >
                <div className="flex flex-col gap-8 px-4 pb-6 pt-8 sm:px-8 lg:px-12">
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
              <div className="absolute inset-x-0 bottom-0 px-4 pb-6 sm:px-8 lg:px-12">
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