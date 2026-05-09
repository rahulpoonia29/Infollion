import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { streamSSE } from 'hono/streaming';
import { streamReply } from './gemini.js';
import {
  appendMessage,
  createChat,
  deleteChat,
  deleteMessage,
  findAttachment,
  getChat,
  listChats,
  setTitleIfDefault,
  toPublicChat,
  toPublicMessage,
} from './store.js';
import {
  MAX_FILE_BYTES,
  SUPPORTED_MIMES,
  type Attachment,
  type AttachmentMime,
} from './types.js';

const app = new Hono();

app.use('/api/*', cors());

app.get('/', (c) => c.text('Gemini chatbot backend'));

app.post('/api/chats', (c) => {
  const chat = createChat();
  return c.json({
    id: chat.id,
    title: chat.title,
    createdAt: chat.createdAt,
  });
});

app.get('/api/chats', (c) => {
  return c.json(listChats());
});

app.get('/api/chats/:id', (c) => {
  const chat = getChat(c.req.param('id'));
  if (!chat) return c.json({ error: 'chat not found' }, 404);
  return c.json(toPublicChat(chat));
});

app.delete('/api/chats/:id', (c) => {
  const ok = deleteChat(c.req.param('id'));
  if (!ok) return c.json({ error: 'chat not found' }, 404);
  return c.json({ ok: true });
});

app.get('/api/chats/:id/attachments/:attId', (c) => {
  const att = findAttachment(c.req.param('id'), c.req.param('attId'));
  if (!att) return c.json({ error: 'attachment not found' }, 404);
  const safeName = att.filename.replace(/"/g, '');
  const encodedName = encodeURIComponent(att.filename);
  return new Response(att.data as unknown as BodyInit, {
    headers: {
      'Content-Type': att.mimeType,
      'Content-Length': String(att.data.length),
      'Content-Disposition': `inline; filename="${safeName}"; filename*=UTF-8''${encodedName}`,
      'Cache-Control': 'private, max-age=3600',
    },
  });
});

app.post('/api/chats/:id/messages', async (c) => {
  const apiKey = c.req.header('x-gemini-key');
  if (!apiKey) {
    return c.json({ error: 'missing x-gemini-key header' }, 400);
  }
  const chatId = c.req.param('id');
  if (!getChat(chatId)) return c.json({ error: 'chat not found' }, 404);

  let form: FormData;
  try {
    form = await c.req.formData();
  } catch {
    return c.json({ error: 'invalid form data' }, 400);
  }

  const text = (form.get('text') as string | null) ?? '';
  const fileEntries = form.getAll('files').filter((v): v is File => v instanceof File);

  if (text.trim().length === 0 && fileEntries.length === 0) {
    return c.json({ error: 'message must include text or a file' }, 400);
  }

  const newAttachments: Omit<Attachment, 'id'>[] = [];
  for (const file of fileEntries) {
    if (!SUPPORTED_MIMES.includes(file.type as AttachmentMime)) {
      return c.json(
        { error: `unsupported file type: ${file.type || file.name}` },
        400,
      );
    }
    if (file.size > MAX_FILE_BYTES) {
      return c.json(
        { error: `file too large: ${file.name} (max 10 MB)` },
        400,
      );
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type as AttachmentMime;
    newAttachments.push({
      filename: file.name,
      mimeType,
      size: buf.length,
      data: buf,
      text: mimeType === 'text/plain' ? buf.toString('utf-8') : undefined,
    });
  }

  const userMessage = appendMessage({
    chatId,
    role: 'user',
    text,
    attachments: newAttachments,
  });
  if (!userMessage) return c.json({ error: 'chat not found' }, 404);

  return streamSSE(c, async (sse) => {
    await sse.writeSSE({
      event: 'user',
      data: JSON.stringify({ user: toPublicMessage(userMessage) }),
    });

    const chatForGemini = getChat(chatId);
    if (!chatForGemini) {
      await sse.writeSSE({
        event: 'error',
        data: JSON.stringify({ error: 'chat not found' }),
      });
      return;
    }

    let assembled = '';
    try {
      for await (const piece of streamReply(apiKey, chatForGemini)) {
        assembled += piece;
        await sse.writeSSE({
          event: 'chunk',
          data: JSON.stringify({ delta: piece }),
        });
        if (c.req.raw.signal.aborted) break;
      }
    } catch (err) {
      deleteMessage(userMessage.id);
      const message =
        err instanceof Error ? err.message : 'Gemini request failed';
      await sse.writeSSE({
        event: 'error',
        data: JSON.stringify({ error: message }),
      });
      return;
    }

    const newTitle = setTitleIfDefault(
      chatId,
      text || newAttachments[0]?.filename || '',
    );
    const assistantMessage = appendMessage({
      chatId,
      role: 'assistant',
      text: assembled,
    });
    await sse.writeSSE({
      event: 'done',
      data: JSON.stringify({
        chatTitle: newTitle,
        assistant: assistantMessage ? toPublicMessage(assistantMessage) : null,
      }),
    });
  });
});

const port = Number(process.env.PORT ?? 3000);
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`);
});
