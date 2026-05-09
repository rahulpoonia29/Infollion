export type AttachmentMime =
  | 'application/pdf'
  | 'text/plain'
  | 'image/png'
  | 'image/jpeg';

export type Attachment = {
  id: string;
  filename: string;
  mimeType: AttachmentMime;
  size: number;
};

export type Message = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  attachments: Attachment[];
  createdAt: number;
};

export type ChatSummary = {
  id: string;
  title: string;
  createdAt: number;
};

export type Chat = ChatSummary & {
  messages: Message[];
};

export type StreamDonePayload = {
  chatTitle: string;
  assistant: Message | null;
};

export type StreamPhase = 'sending' | 'waiting' | 'streaming' | null;
