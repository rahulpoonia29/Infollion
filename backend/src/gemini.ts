import { GoogleGenAI } from '@google/genai';
import type { Content, Part } from '@google/genai';
import type { Attachment, Chat } from './types.js';

const MODEL = 'gemini-2.5-flash';

function partsForUserTurn(text: string, attachments: Attachment[]): Part[] {
  const parts: Part[] = [];
  for (const a of attachments) {
    if (a.mimeType === 'text/plain') {
      parts.push({
        text: `[Attached document: ${a.filename}]\n${a.text ?? ''}`,
      });
    } else {
      parts.push({
        inlineData: {
          mimeType: a.mimeType,
          data: a.data.toString('base64'),
        },
      });
    }
  }
  if (text.trim().length > 0 || parts.length === 0) {
    parts.push({ text });
  }
  return parts;
}

export function buildContents(chat: Chat): Content[] {
  return chat.messages.map<Content>((m) => {
    if (m.role === 'user') {
      return { role: 'user', parts: partsForUserTurn(m.text, m.attachments) };
    }
    return { role: 'model', parts: [{ text: m.text }] };
  });
}

export async function generateReply(
  apiKey: string,
  chat: Chat,
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: buildContents(chat),
  });
  return response.text ?? '';
}

export async function* streamReply(
  apiKey: string,
  chat: Chat,
): AsyncGenerator<string> {
  const ai = new GoogleGenAI({ apiKey });
  const stream = await ai.models.generateContentStream({
    model: MODEL,
    contents: buildContents(chat),
  });
  for await (const chunk of stream) {
    const text = chunk.text;
    if (text) yield text;
  }
}
