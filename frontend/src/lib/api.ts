import type { Chat, ChatSummary, Message, StreamDonePayload } from '../types';

const API_KEY_STORAGE = 'gemini_api_key';

export function getStoredApiKey(): string {
  return localStorage.getItem(API_KEY_STORAGE) ?? '';
}

export function setStoredApiKey(key: string): void {
  localStorage.setItem(API_KEY_STORAGE, key);
}

export function clearStoredApiKey(): void {
  localStorage.removeItem(API_KEY_STORAGE);
}

function headers(): Record<string, string> {
  const key = getStoredApiKey();
  return key ? { 'x-gemini-key': key } : {};
}

async function asJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body && typeof body.error === 'string') msg = body.error;
    } catch {
      // ignore json parse error
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export async function listChats(): Promise<ChatSummary[]> {
  const res = await fetch('/api/chats');
  return asJson<ChatSummary[]>(res);
}

export async function createChat(): Promise<ChatSummary> {
  const res = await fetch('/api/chats', { method: 'POST' });
  return asJson<ChatSummary>(res);
}

export async function getChat(id: string): Promise<Chat> {
  const res = await fetch(`/api/chats/${id}`);
  return asJson<Chat>(res);
}

export async function deleteChat(id: string): Promise<void> {
  const res = await fetch(`/api/chats/${id}`, { method: 'DELETE' });
  await asJson<{ ok: true }>(res);
}

export type StreamHandlers = {
  onUser: (msg: Message) => void;
  onChunk: (delta: string) => void;
  onDone: (info: StreamDonePayload) => void;
  onError: (msg: string) => void;
};

export async function streamSendMessage(
  chatId: string,
  text: string,
  files: File[],
  handlers: StreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const form = new FormData();
  form.set('text', text);
  for (const f of files) form.append('files', f);

  let res: Response;
  try {
    res = await fetch(`/api/chats/${chatId}/messages`, {
      method: 'POST',
      body: form,
      headers: headers(),
      signal,
    });
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') return;
    handlers.onError((err as Error).message ?? 'Network error');
    return;
  }

  if (!res.ok || !res.body) {
    let msg = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body && typeof body.error === 'string') msg = body.error;
    } catch {
      // ignore
    }
    handlers.onError(msg);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  function dispatch(eventName: string, dataStr: string) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(dataStr);
    } catch {
      return;
    }
    const data = parsed as Record<string, unknown>;
    if (eventName === 'user' && data.user) {
      handlers.onUser(data.user as Message);
    } else if (eventName === 'chunk' && typeof data.delta === 'string') {
      handlers.onChunk(data.delta);
    } else if (eventName === 'done') {
      handlers.onDone({
        chatTitle: String(data.chatTitle ?? ''),
        assistant: (data.assistant as Message | null) ?? null,
      });
    } else if (eventName === 'error') {
      handlers.onError(String(data.error ?? 'Stream error'));
    }
  }

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const rawEvent = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        let eventName = 'message';
        const dataLines: string[] = [];
        for (const line of rawEvent.split('\n')) {
          if (line.startsWith('event:')) {
            eventName = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            dataLines.push(line.slice(5).replace(/^ /, ''));
          }
        }
        if (dataLines.length > 0) dispatch(eventName, dataLines.join('\n'));
      }
    }
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') return;
    handlers.onError((err as Error).message ?? 'Stream interrupted');
  }
}

export function attachmentUrl(chatId: string, attId: string): string {
  return `/api/chats/${chatId}/attachments/${attId}`;
}
