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
  data: Buffer;
  text?: string;
};

export type Message = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  attachments: Attachment[];
  createdAt: number;
};

export type Chat = {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
};

export type ChatSummary = Pick<Chat, 'id' | 'title' | 'createdAt'>;

export type PublicAttachment = Omit<Attachment, 'data' | 'text'>;

export type PublicMessage = Omit<Message, 'attachments'> & {
  attachments: PublicAttachment[];
};

export type PublicChat = Omit<Chat, 'messages'> & {
  messages: PublicMessage[];
};

export const SUPPORTED_MIMES: AttachmentMime[] = [
  'application/pdf',
  'text/plain',
  'image/png',
  'image/jpeg',
];

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
