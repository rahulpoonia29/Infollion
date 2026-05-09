import { useEffect, useMemo, useRef, useState } from 'react';
import type { AttachmentMime } from '../types';
import AttachmentChip from './AttachmentChip';

type Props = {
  disabled: boolean;
  pending: boolean;
  onSend: (text: string, files: File[]) => Promise<void>;
  onStop?: () => void;
  droppedFiles?: File[] | null;
  onDroppedConsumed?: () => void;
  autoFocus?: boolean;
};

const ACCEPTED_MIMES: AttachmentMime[] = [
  'application/pdf',
  'text/plain',
  'image/png',
  'image/jpeg',
];

const MAX_BYTES = 10 * 1024 * 1024;

export default function Composer({
  disabled,
  pending,
  onSend,
  onStop,
  droppedFiles,
  onDroppedConsumed,
  autoFocus = false,
}: Props) {
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const previewUrls = useMemo(() => {
    return files.map((f) =>
      f.type.startsWith('image/') ? URL.createObjectURL(f) : '',
    );
  }, [files]);

  useEffect(() => {
    return () => {
      for (const url of previewUrls) if (url) URL.revokeObjectURL(url);
    };
  }, [previewUrls]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = '0px';
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
  }, [text]);

  useEffect(() => {
    if (autoFocus && !disabled) textareaRef.current?.focus();
  }, [autoFocus, disabled]);

  useEffect(() => {
    if (!pending) textareaRef.current?.focus();
  }, [pending]);

  useEffect(() => {
    if (!droppedFiles || droppedFiles.length === 0) return;
    const accepted: File[] = [];
    for (const f of droppedFiles) {
      if (!ACCEPTED_MIMES.includes(f.type as AttachmentMime)) continue;
      if (f.size > MAX_BYTES) {
        setError(`Too large (10 MB max): ${f.name}`);
        continue;
      }
      accepted.push(f);
    }
    if (accepted.length > 0) {
      setError(null);
      setFiles((prev) => [...prev, ...accepted]);
    }
    onDroppedConsumed?.();
  }, [droppedFiles, onDroppedConsumed]);

  function pickFiles() {
    fileInputRef.current?.click();
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (selected.length === 0) return;
    const accepted: File[] = [];
    for (const f of selected) {
      if (!ACCEPTED_MIMES.includes(f.type as AttachmentMime)) {
        setError(`Unsupported file: ${f.name}`);
        continue;
      }
      if (f.size > MAX_BYTES) {
        setError(`Too large (10 MB max): ${f.name}`);
        continue;
      }
      accepted.push(f);
    }
    if (accepted.length > 0) {
      setError(null);
      setFiles((prev) => [...prev, ...accepted]);
    }
  }

  function removeFile(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  async function submit() {
    if (disabled || pending) return;
    if (!text.trim() && files.length === 0) return;
    const sendText = text;
    const sendFiles = files;
    setText('');
    setFiles([]);
    setError(null);
    try {
      await onSend(sendText, sendFiles);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Send failed');
      setText(sendText);
      setFiles(sendFiles);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  }

  const canSend = !disabled && !pending && (text.trim() || files.length > 0);

  return (
    <div className="px-4 pb-6">
      <div className="mx-auto max-w-3xl xl:max-w-4xl 2xl:max-w-5xl">
        {error && (
          <div className="mb-2 text-xs text-red-400">{error}</div>
        )}
        <div className="rounded-3xl bg-neutral-800 border border-neutral-700 px-3 py-3">
          {files.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {files.map((f, i) => (
                <AttachmentChip
                  key={`${f.name}-${i}`}
                  filename={f.name}
                  mimeType={f.type as AttachmentMime}
                  size={f.size}
                  previewUrl={previewUrls[i] || undefined}
                  onRemove={() => removeFile(i)}
                />
              ))}
            </div>
          )}
          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={pickFiles}
              aria-label="Attach file"
              className="h-9 w-9 shrink-0 rounded-full hover:bg-neutral-700 text-neutral-300 flex items-center justify-center"
            >
              <PlusIcon />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.txt,image/png,image/jpeg,application/pdf,text/plain"
              onChange={onFileChange}
              className="hidden"
            />
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              placeholder="Ask anything"
              disabled={disabled}
              className="flex-1 resize-none bg-transparent text-neutral-100 placeholder-neutral-500 outline-none px-1 py-2 max-h-52"
            />
            {pending && onStop ? (
              <button
                type="button"
                onClick={onStop}
                aria-label="Stop generating"
                className="h-9 w-9 shrink-0 rounded-full bg-neutral-200 text-neutral-900 flex items-center justify-center hover:bg-white"
              >
                <StopIcon />
              </button>
            ) : (
              <button
                type="button"
                onClick={submit}
                disabled={!canSend}
                aria-label="Send message"
                className="h-9 w-9 shrink-0 rounded-full bg-blue-600 text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-500"
              >
                <ArrowUp />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PlusIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function ArrowUp() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="5 12 12 5 19 12" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}
