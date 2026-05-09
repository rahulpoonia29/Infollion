import { randomUUID } from 'node:crypto';
import { db } from './db.js';
import type {
  Attachment,
  AttachmentMime,
  Chat,
  ChatSummary,
  Message,
  PublicAttachment,
  PublicChat,
  PublicMessage,
} from './types.js';

type ChatRow = { id: string; title: string; created_at: number };
type MessageRow = {
  id: string;
  chat_id: string;
  role: 'user' | 'assistant';
  text: string;
  created_at: number;
};
type AttachmentRow = {
  id: string;
  message_id: string;
  chat_id: string;
  filename: string;
  mime_type: AttachmentMime;
  size: number;
  data: Buffer;
  text_content: string | null;
};

const stmts = {
  insertChat: db.prepare<[string, string, number]>(
    'INSERT INTO chats (id, title, created_at) VALUES (?, ?, ?)',
  ),
  getChat: db.prepare<[string], ChatRow>('SELECT * FROM chats WHERE id = ?'),
  listChats: db.prepare<[], ChatRow>(
    'SELECT * FROM chats ORDER BY created_at DESC',
  ),
  deleteChat: db.prepare<[string]>('DELETE FROM chats WHERE id = ?'),
  updateTitle: db.prepare<[string, string]>(
    'UPDATE chats SET title = ? WHERE id = ?',
  ),
  insertMessage: db.prepare<[string, string, 'user' | 'assistant', string, number]>(
    'INSERT INTO messages (id, chat_id, role, text, created_at) VALUES (?, ?, ?, ?, ?)',
  ),
  deleteMessage: db.prepare<[string]>('DELETE FROM messages WHERE id = ?'),
  listMessages: db.prepare<[string], MessageRow>(
    'SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at ASC, rowid ASC',
  ),
  insertAttachment: db.prepare<
    [string, string, string, string, AttachmentMime, number, Buffer, string | null]
  >(
    'INSERT INTO attachments (id, message_id, chat_id, filename, mime_type, size, data, text_content) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  ),
  listAttachmentsByMessage: db.prepare<[string], AttachmentRow>(
    'SELECT * FROM attachments WHERE message_id = ? ORDER BY rowid ASC',
  ),
  getAttachment: db.prepare<[string, string], AttachmentRow>(
    'SELECT * FROM attachments WHERE chat_id = ? AND id = ?',
  ),
};

function rowToAttachment(row: AttachmentRow): Attachment {
  return {
    id: row.id,
    filename: row.filename,
    mimeType: row.mime_type,
    size: row.size,
    data: row.data,
    text: row.text_content ?? undefined,
  };
}

function rowToMessage(row: MessageRow): Message {
  const attachments = stmts.listAttachmentsByMessage
    .all(row.id)
    .map(rowToAttachment);
  return {
    id: row.id,
    role: row.role,
    text: row.text,
    attachments,
    createdAt: row.created_at,
  };
}

function rowToChat(row: ChatRow): Chat {
  const messages = stmts.listMessages.all(row.id).map(rowToMessage);
  return {
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    messages,
  };
}

export function createChat(): Chat {
  const id = randomUUID();
  const title = 'New chat';
  const createdAt = Date.now();
  stmts.insertChat.run(id, title, createdAt);
  return { id, title, createdAt, messages: [] };
}

export function getChat(id: string): Chat | undefined {
  const row = stmts.getChat.get(id);
  return row ? rowToChat(row) : undefined;
}

export function deleteChat(id: string): boolean {
  return stmts.deleteChat.run(id).changes > 0;
}

export function listChats(): ChatSummary[] {
  return stmts.listChats.all().map((r) => ({
    id: r.id,
    title: r.title,
    createdAt: r.created_at,
  }));
}

type AppendInput = {
  chatId: string;
  role: 'user' | 'assistant';
  text: string;
  attachments?: Omit<Attachment, 'id'>[];
};

export function appendMessage(input: AppendInput): Message | undefined {
  const chat = stmts.getChat.get(input.chatId);
  if (!chat) return undefined;

  const messageId = randomUUID();
  const createdAt = Date.now();

  const tx = db.transaction(() => {
    stmts.insertMessage.run(messageId, input.chatId, input.role, input.text, createdAt);
    const persisted: Attachment[] = [];
    for (const a of input.attachments ?? []) {
      const attId = randomUUID();
      stmts.insertAttachment.run(
        attId,
        messageId,
        input.chatId,
        a.filename,
        a.mimeType,
        a.size,
        a.data,
        a.text ?? null,
      );
      persisted.push({ ...a, id: attId });
    }
    return persisted;
  });

  const attachments = tx();
  return {
    id: messageId,
    role: input.role,
    text: input.text,
    attachments,
    createdAt,
  };
}

export function deleteMessage(messageId: string): void {
  stmts.deleteMessage.run(messageId);
}

export function setTitleIfDefault(chatId: string, fromText: string): string | undefined {
  const chat = stmts.getChat.get(chatId);
  if (!chat) return undefined;
  if (chat.title !== 'New chat') return chat.title;
  const trimmed = fromText.trim().replace(/\s+/g, ' ');
  if (!trimmed) return chat.title;
  const next = trimmed.length > 40 ? trimmed.slice(0, 40) + '…' : trimmed;
  stmts.updateTitle.run(next, chatId);
  return next;
}

export function findAttachment(
  chatId: string,
  attId: string,
): Attachment | undefined {
  const row = stmts.getAttachment.get(chatId, attId);
  return row ? rowToAttachment(row) : undefined;
}

export function toPublicAttachment(a: Attachment): PublicAttachment {
  return {
    id: a.id,
    filename: a.filename,
    mimeType: a.mimeType,
    size: a.size,
  };
}

export function toPublicMessage(m: Message): PublicMessage {
  return {
    id: m.id,
    role: m.role,
    text: m.text,
    createdAt: m.createdAt,
    attachments: m.attachments.map(toPublicAttachment),
  };
}

export function toPublicChat(c: Chat): PublicChat {
  return {
    id: c.id,
    title: c.title,
    createdAt: c.createdAt,
    messages: c.messages.map(toPublicMessage),
  };
}
