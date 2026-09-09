import { useState } from "react";
import {
  ChatCircleIcon,
  HouseSimpleIcon,
  PlusIcon,
  SidebarSimpleIcon,
} from "@phosphor-icons/react";

type Recent = { id: string; label: string };

const FAKE_RECENTS: Recent[] = [
  { id: "r1", label: "Supplier records" },
  { id: "r2", label: "Urgent to-dos this morning" },
  { id: "r3", label: "Flavor page ticket" },
  { id: "r4", label: "Workload summary" },
  { id: "r5", label: "Off-board a supplier" },
  { id: "r6", label: "Batch restock function" },
];

export default function SidebarNav({
  activeTitle,
  onNewChat,
  onPickRecent,
}: {
  activeTitle?: string | null;
  onNewChat: () => void;
  onPickRecent: (label: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <aside
        aria-label="Workspace navigation"
        className="flex h-full w-[52px] shrink-0 flex-col items-center gap-2 py-3 transition-[width] duration-280"
      >
        <button
          type="button"
          aria-label="Expand sidebar"
          onClick={() => setCollapsed(false)}
          className="flex size-9 items-center justify-center rounded-[8px] text-ink-3 transition-colors duration-150 hover:bg-hover-2 hover:text-ink"
        >
          <SidebarSimpleIcon size={20} mirrored />
        </button>
        <div className="mt-2 flex h-px w-7 bg-line" />
        <button
          type="button"
          aria-label="New chat"
          onClick={onNewChat}
          className="mt-1 flex size-9 items-center justify-center rounded-[8px] text-ink-3 transition-colors duration-150 hover:bg-hover-2 hover:text-ink"
        >
          <PlusIcon size={20} />
        </button>
      </aside>
    );
  }

  return (
    <aside
      aria-label="Workspace navigation"
      className="relative flex h-full w-[224px] shrink-0 flex-col transition-[width] duration-280"
    >
      <div className="mb-2.5 flex h-10 shrink-0 items-center justify-between px-1 pl-2">
        <div className="flex items-center gap-1.5">
          <span className="flex size-6 items-center justify-center rounded-[7px] bg-ink text-[11px] font-semibold text-surface">
            R
          </span>
          <span className="text-[14px] font-medium text-ink">RAG Chat</span>
        </div>
        <button
          type="button"
          aria-label="Collapse sidebar"
          onClick={() => setCollapsed(true)}
          className="flex size-8 items-center justify-center rounded-[8px] text-ink-3 transition-colors duration-150 hover:bg-hover-2 hover:text-ink"
        >
          <SidebarSimpleIcon size={20} />
        </button>
      </div>

      <nav className="flex flex-col gap-px px-1.5">
        <button
          type="button"
          onClick={onNewChat}
          className="flex h-8 items-center gap-2 rounded-[8px] px-2 text-left text-[14px] font-medium text-ink transition-colors duration-150 hover:bg-hover-2"
        >
          <PlusIcon size={16} className="shrink-0 text-ink-2" />
          New chat
        </button>
        <button
          type="button"
          className="flex h-8 items-center gap-2 rounded-[8px] px-2 text-left text-[14px] font-medium text-ink-2 transition-colors duration-150 hover:bg-hover hover:text-ink"
        >
          <HouseSimpleIcon size={16} className="shrink-0 text-ink-2" />
          Home
        </button>
      </nav>

      <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
        <div className="mx-1.5 mb-1 flex h-8 items-center justify-between px-1.5">
          <div className="flex items-center gap-1 text-[12.5px] font-medium text-ink-3">
            <ChatCircleIcon size={14} />
            <span>Chats</span>
          </div>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="text-ink-3"
            aria-hidden
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
        </div>

        <div className="mt-1 flex flex-col gap-px px-1">
          {FAKE_RECENTS.map((recent) => {
            const active = activeTitle === recent.label;
            return (
              <button
                key={recent.id}
                type="button"
                title={recent.label}
                onClick={() => onPickRecent(recent.label)}
                className={`flex h-8 items-center gap-2 rounded-[8px] px-2 text-left text-[14px] transition-colors duration-150 ${
                  active ? "bg-hover-2 text-ink" : "text-ink-2 hover:bg-hover hover:text-ink"
                }`}
              >
                <ChatCircleIcon size={14} className="shrink-0 text-ink-3" />
                <span className="min-w-0 flex-1 truncate">{recent.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mx-1.5 mt-3 border-t border-line pt-3">
        <button
          type="button"
          onClick={onNewChat}
          className="flex h-8 w-full items-center justify-center gap-1.5 rounded-[9px] bg-hover-2 text-[12.5px] font-medium text-ink transition-colors duration-150 hover:bg-line-strong"
        >
          <PlusIcon size={14} />
          New conversation
        </button>
      </div>
    </aside>
  );
}