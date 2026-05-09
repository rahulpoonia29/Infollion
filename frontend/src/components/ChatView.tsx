import { useState } from 'react';
import type { AttachmentMime, Chat, StreamPhase } from '../types';
import Composer from './Composer';
import MessageList from './MessageList';

type Props = {
  chat: Chat | null;
  phase: StreamPhase;
  apiKeyMissing: boolean;
  streamError: string | null;
  chatLoading: boolean;
  chatNotFound: boolean;
  onSend: (text: string, files: File[]) => Promise<void>;
  onStop: () => void;
  onNewChat: () => void;
};

const ACCEPTED_MIMES: AttachmentMime[] = [
  'application/pdf',
  'text/plain',
  'image/png',
  'image/jpeg',
];

export default function ChatView({
  chat,
  phase,
  apiKeyMissing,
  streamError,
  chatLoading,
  chatNotFound,
  onSend,
  onStop,
  onNewChat,
}: Props) {
  const pending = phase !== null;
  const [dragOver, setDragOver] = useState(false);
  const [pendingDropFiles, setPendingDropFiles] = useState<File[] | null>(null);
  const isEmpty = !chat || chat.messages.length === 0;

  function onDragOver(e: React.DragEvent) {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      setDragOver(true);
    }
  }
  function onDragLeave(e: React.DragEvent) {
    if (e.currentTarget === e.target) setDragOver(false);
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      ACCEPTED_MIMES.includes(f.type as AttachmentMime),
    );
    if (files.length > 0) setPendingDropFiles(files);
  }

  return (
    <main
      className="flex-1 flex flex-col bg-black text-neutral-100 min-w-0 relative"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <header className="h-12 flex items-center px-4 border-b border-neutral-900 shrink-0">
        <div className="text-sm text-neutral-300 truncate">
          {chatNotFound ? 'Chat not found' : chat ? chat.title : 'New chat'}
        </div>
      </header>

      {chatNotFound ? (
        <NotFoundState onNewChat={onNewChat} />
      ) : chatLoading ? (
        <LoadingState />
      ) : isEmpty ? (
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          <h1 className="text-3xl font-semibold text-neutral-100 mb-6">
            What are you working on?
          </h1>
          <div className="w-full">
            {streamError && <ErrorBanner text={streamError} />}
            <Composer
              disabled={apiKeyMissing}
              pending={pending}
              onSend={onSend}
              onStop={onStop}
              droppedFiles={pendingDropFiles}
              onDroppedConsumed={() => setPendingDropFiles(null)}
              autoFocus
            />
          </div>
        </div>
      ) : (
        <>
          <MessageList chatId={chat.id} messages={chat.messages} phase={phase} />
          {streamError && <ErrorBanner text={streamError} />}
          <Composer
            disabled={apiKeyMissing}
            pending={pending}
            onSend={onSend}
            onStop={onStop}
            droppedFiles={pendingDropFiles}
            onDroppedConsumed={() => setPendingDropFiles(null)}
            autoFocus
          />
        </>
      )}

      {dragOver && (
        <div className="pointer-events-none absolute inset-0 bg-blue-600/10 border-2 border-dashed border-blue-500 rounded-lg flex items-center justify-center">
          <div className="text-blue-300 text-lg">Drop files to attach</div>
        </div>
      )}
    </main>
  );
}

function LoadingState() {
  return (
    <div className="flex-1 flex items-center justify-center text-neutral-500 text-sm">
      Loading chat…
    </div>
  );
}

function NotFoundState({ onNewChat }: { onNewChat: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 text-center">
      <h2 className="text-2xl font-semibold text-neutral-200 mb-2">
        This chat is not available
      </h2>
      <p className="text-sm text-neutral-400 max-w-md mb-6">
        Chat history lives only in the backend's memory. If the server was
        restarted, this conversation has been cleared.
      </p>
      <button
        type="button"
        onClick={onNewChat}
        className="rounded-lg bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 text-sm"
      >
        Start a new chat
      </button>
    </div>
  );
}

function ErrorBanner({ text }: { text: string }) {
  return (
    <div className="mx-auto max-w-3xl xl:max-w-4xl 2xl:max-w-5xl w-full px-4 pb-2">
      <div className="rounded-lg bg-red-950/60 border border-red-800 px-3 py-2 text-sm text-red-200">
        {text}
      </div>
    </div>
  );
}
