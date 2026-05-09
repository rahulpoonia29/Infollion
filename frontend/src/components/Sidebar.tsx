import { useState } from 'react';
import { formatRelative } from '../lib/format';
import type { ChatSummary } from '../types';

type Props = {
  chats: ChatSummary[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onOpenApiKey: () => void;
};

export default function Sidebar({
  chats,
  activeId,
  onSelect,
  onNew,
  onDelete,
  onOpenApiKey,
}: Props) {
  const [query, setQuery] = useState('');

  const filtered = query.trim()
    ? chats.filter((c) =>
        c.title.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : chats;

  return (
    <aside className="w-64 shrink-0 bg-neutral-950 border-r border-neutral-800 flex flex-col">
      <div className="p-3">
        <button
          type="button"
          onClick={onNew}
          className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-neutral-100 hover:bg-neutral-800"
        >
          <PlusIcon />
          New chat
        </button>
      </div>
      {chats.length > 3 && (
        <div className="px-3 pb-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chats"
            className="w-full rounded-md bg-neutral-900 border border-neutral-800 px-2.5 py-1.5 text-sm text-neutral-100 placeholder-neutral-500 outline-none focus:border-neutral-600"
          />
        </div>
      )}
      <div className="px-3 pb-2 text-xs uppercase tracking-wide text-neutral-500">
        Chats
      </div>
      <nav className="flex-1 overflow-y-auto px-2 pb-2">
        {chats.length === 0 ? (
          <div className="px-3 py-2 text-sm text-neutral-500">No chats yet</div>
        ) : filtered.length === 0 ? (
          <div className="px-3 py-2 text-sm text-neutral-500">
            No matches for "{query}"
          </div>
        ) : (
          filtered.map((c) => (
            <div
              key={c.id}
              className={`group flex items-center rounded-lg px-2 ${
                c.id === activeId ? 'bg-neutral-800' : 'hover:bg-neutral-800/60'
              }`}
            >
              <button
                type="button"
                onClick={() => onSelect(c.id)}
                className="flex-1 min-w-0 text-left py-2"
                title={c.title}
              >
                <div className="truncate text-sm text-neutral-200">{c.title}</div>
                <div className="text-xs text-neutral-500">
                  {formatRelative(c.createdAt)}
                </div>
              </button>
              <button
                type="button"
                onClick={() => onDelete(c.id)}
                aria-label="Delete chat"
                className="opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-red-400 px-2 py-1 text-xs"
              >
                ×
              </button>
            </div>
          ))
        )}
      </nav>
      <div className="border-t border-neutral-800 p-3">
        <button
          type="button"
          onClick={onOpenApiKey}
          className="text-xs text-neutral-400 hover:text-neutral-200"
        >
          Configure Gemini API key
        </button>
      </div>
    </aside>
  );
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
