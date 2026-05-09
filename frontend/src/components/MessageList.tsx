import { useEffect, useRef } from 'react';
import type { Message, StreamPhase } from '../types';
import { attachmentUrl } from '../lib/api';
import AssistantBubble from './AssistantBubble';
import AttachmentChip from './AttachmentChip';

type Props = {
  chatId: string | null;
  messages: Message[];
  phase: StreamPhase;
};

export default function MessageList({ chatId, messages, phase }: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);

  const lastAssistantId = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') return messages[i].id;
    }
    return null;
  })();
  const tail = messages.length === 0 ? 0 : messages[messages.length - 1].text.length;

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distance < 80;
  }

  useEffect(() => {
    if (stickToBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages.length, tail]);

  return (
    <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl xl:max-w-4xl 2xl:max-w-5xl px-4 py-6 flex flex-col gap-5">
        {messages.map((m) => (
          <MessageRow
            key={m.id}
            chatId={chatId}
            message={m}
            phase={phase && m.id === lastAssistantId ? phase : null}
          />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

function MessageRow({
  chatId,
  message,
  phase,
}: {
  chatId: string | null;
  message: Message;
  phase: StreamPhase;
}) {
  if (message.role === 'user') {
    const hasRealAttachmentIds =
      chatId !== null &&
      message.attachments.length > 0 &&
      !message.id.startsWith('optimistic-');
    return (
      <div className="flex justify-end">
        <div className="flex flex-col items-end gap-2 max-w-[75%]">
          {message.attachments.length > 0 && (
            <div className="flex flex-wrap justify-end gap-2">
              {message.attachments.map((a) => {
                const url =
                  hasRealAttachmentIds && chatId
                    ? attachmentUrl(chatId, a.id)
                    : undefined;
                return (
                  <AttachmentChip
                    key={a.id}
                    attachment={a}
                    previewUrl={url}
                    openUrl={url}
                  />
                );
              })}
            </div>
          )}
          {message.text && (
            <div className="rounded-2xl bg-neutral-700 text-neutral-50 px-4 py-2 leading-relaxed whitespace-pre-wrap wrap-break-word">
              {message.text}
            </div>
          )}
        </div>
      </div>
    );
  }
  return (
    <div className="flex">
      <AssistantBubble text={message.text} phase={phase} />
    </div>
  );
}
