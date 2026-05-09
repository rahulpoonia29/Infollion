import { useEffect, useRef, useState } from 'react';
import ApiKeyModal from './components/ApiKeyModal';
import ChatView from './components/ChatView';
import Sidebar from './components/Sidebar';
import {
  createChat as apiCreateChat,
  deleteChat as apiDeleteChat,
  getChat as apiGetChat,
  getStoredApiKey,
  listChats as apiListChats,
  setStoredApiKey,
  streamSendMessage,
} from './lib/api';
import {
  chatIdFromLocation,
  navigateToChat,
  onRouteChange,
} from './lib/route';
import type {
  Attachment,
  AttachmentMime,
  Chat,
  ChatSummary,
  Message,
  StreamPhase,
} from './types';

function makeOptimisticUserMessage(text: string, files: File[]): Message {
  return {
    id: 'optimistic-user-' + crypto.randomUUID(),
    role: 'user',
    text,
    attachments: files.map<Attachment>((f) => ({
      id: 'optimistic-att-' + crypto.randomUUID(),
      filename: f.name,
      mimeType: f.type as AttachmentMime,
      size: f.size,
    })),
    createdAt: Date.now(),
  };
}

function makePlaceholderAssistant(): Message {
  return {
    id: 'streaming-assistant',
    role: 'assistant',
    text: '',
    attachments: [],
    createdAt: Date.now(),
  };
}

export default function App() {
  const [apiKey, setApiKey] = useState<string>(() => getStoredApiKey());
  const [showApiKeyModal, setShowApiKeyModal] = useState<boolean>(
    () => !getStoredApiKey(),
  );
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(() =>
    chatIdFromLocation(),
  );
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [chatLoading, setChatLoading] = useState<boolean>(false);
  const [chatNotFound, setChatNotFound] = useState<boolean>(false);
  const [phase, setPhase] = useState<StreamPhase>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Initial chats list.
  useEffect(() => {
    apiListChats()
      .then(setChats)
      .catch(() => setChats([]));
  }, []);

  // Sync activeId with URL changes (back/forward).
  useEffect(() => {
    return onRouteChange((id) => {
      abortRef.current?.abort();
      setStreamError(null);
      setActiveId(id);
    });
  }, []);

  // Whenever activeId changes, fetch the chat unless we already have it
  // (e.g. just created locally).
  useEffect(() => {
    setChatNotFound(false);
    if (!activeId) {
      setActiveChat(null);
      setChatLoading(false);
      return;
    }
    if (activeChat?.id === activeId) {
      setChatLoading(false);
      return;
    }
    let cancelled = false;
    setChatLoading(true);
    apiGetChat(activeId)
      .then((c) => {
        if (cancelled) return;
        setActiveChat(c);
        setChatLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setActiveChat(null);
        setChatLoading(false);
        setChatNotFound(true);
        setChats((prev) => prev.filter((x) => x.id !== activeId));
      });
    return () => {
      cancelled = true;
    };
    // We only want to react to activeId, not activeChat changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  function handleSaveKey(key: string) {
    setStoredApiKey(key);
    setApiKey(key);
    setShowApiKeyModal(false);
  }

  function handleNewChat() {
    abortRef.current?.abort();
    setActiveId(null);
    setActiveChat(null);
    setStreamError(null);
    setChatNotFound(false);
    navigateToChat(null);
  }

  function handleSelectChat(id: string) {
    if (id === activeId) return;
    abortRef.current?.abort();
    setStreamError(null);
    setChatNotFound(false);
    setActiveId(id);
    navigateToChat(id);
  }

  async function handleDeleteChat(id: string) {
    try {
      await apiDeleteChat(id);
    } catch {
      // ignore — refresh list anyway
    }
    setChats((prev) => prev.filter((c) => c.id !== id));
    if (activeId === id) {
      setActiveId(null);
      setActiveChat(null);
      navigateToChat(null);
    }
  }

  function handleStop() {
    abortRef.current?.abort();
  }

  async function handleSend(text: string, files: File[]) {
    if (!apiKey) {
      setShowApiKeyModal(true);
      throw new Error('Add your Gemini API key first');
    }
    setStreamError(null);
    setChatNotFound(false);

    let chatId = activeId;
    if (!chatId) {
      const created = await apiCreateChat();
      chatId = created.id;
      setActiveId(created.id);
      setChats((prev) => [created, ...prev]);
      setActiveChat({ ...created, messages: [] });
      navigateToChat(created.id);
    }

    const optimisticUser = makeOptimisticUserMessage(text, files);
    const placeholder = makePlaceholderAssistant();
    setActiveChat((prev) =>
      prev && prev.id === chatId
        ? { ...prev, messages: [...prev.messages, optimisticUser, placeholder] }
        : prev,
    );

    setPhase('sending');
    const ac = new AbortController();
    abortRef.current = ac;

    await streamSendMessage(
      chatId,
      text,
      files,
      {
        onUser: (real) => {
          setPhase('waiting');
          setActiveChat((prev) => {
            if (!prev || prev.id !== chatId) return prev;
            return {
              ...prev,
              messages: prev.messages.map((m) =>
                m.id === optimisticUser.id ? real : m,
              ),
            };
          });
        },
        onChunk: (delta) => {
          setPhase('streaming');
          setActiveChat((prev) => {
            if (!prev || prev.id !== chatId) return prev;
            return {
              ...prev,
              messages: prev.messages.map((m) =>
                m.id === placeholder.id
                  ? { ...m, text: m.text + delta }
                  : m,
              ),
            };
          });
        },
        onDone: (info) => {
          setActiveChat((prev) => {
            if (!prev || prev.id !== chatId) return prev;
            return {
              ...prev,
              title: info.chatTitle || prev.title,
              messages: info.assistant
                ? prev.messages.map((m) =>
                    m.id === placeholder.id ? info.assistant! : m,
                  )
                : prev.messages,
            };
          });
          setChats((prev) =>
            prev.map((c) =>
              c.id === chatId
                ? { ...c, title: info.chatTitle || c.title }
                : c,
            ),
          );
        },
        onError: (msg) => {
          setStreamError(msg);
          setActiveChat((prev) => {
            if (!prev || prev.id !== chatId) return prev;
            return {
              ...prev,
              messages: prev.messages.filter(
                (m) => m.id !== optimisticUser.id && m.id !== placeholder.id,
              ),
            };
          });
        },
      },
      ac.signal,
    );

    setPhase(null);
    abortRef.current = null;
  }

  return (
    <div className="h-screen w-screen flex bg-black text-neutral-100 overflow-hidden">
      <Sidebar
        chats={chats}
        activeId={activeId}
        onSelect={handleSelectChat}
        onNew={handleNewChat}
        onDelete={handleDeleteChat}
        onOpenApiKey={() => setShowApiKeyModal(true)}
      />
      <ChatView
        chat={activeChat}
        phase={phase}
        apiKeyMissing={!apiKey}
        streamError={streamError}
        chatLoading={chatLoading && !activeChat}
        chatNotFound={chatNotFound}
        onSend={handleSend}
        onStop={handleStop}
        onNewChat={handleNewChat}
      />
      {showApiKeyModal && (
        <ApiKeyModal
          initialKey={apiKey}
          onSave={handleSaveKey}
          onClose={apiKey ? () => setShowApiKeyModal(false) : undefined}
        />
      )}
    </div>
  );
}
