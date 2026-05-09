import { formatBytes } from '../lib/format';
import type { Attachment, AttachmentMime } from '../types';

type Props = {
  attachment?: Attachment;
  filename?: string;
  mimeType?: AttachmentMime;
  size?: number;
  previewUrl?: string;
  openUrl?: string;
  onRemove?: () => void;
  className?: string;
};

function isImage(mime?: string): boolean {
  return mime === 'image/png' || mime === 'image/jpeg';
}

function fileLabel(mime?: string): string {
  if (mime === 'application/pdf') return 'PDF';
  if (mime === 'text/plain') return 'TXT';
  return 'FILE';
}

export default function AttachmentChip({
  attachment,
  filename,
  mimeType,
  size,
  previewUrl,
  openUrl,
  onRemove,
  className = '',
}: Props) {
  const name = filename ?? attachment?.filename ?? '';
  const mime = mimeType ?? attachment?.mimeType;
  const bytes = size ?? attachment?.size;

  if (isImage(mime) && previewUrl) {
    const inner = (
      <img
        src={previewUrl}
        alt={name}
        className={`h-14 w-14 rounded-lg object-cover border border-neutral-700 ${
          openUrl ? 'transition-opacity hover:opacity-90' : ''
        }`}
      />
    );
    return (
      <div className={`relative inline-block ${className}`}>
        {openUrl ? (
          <a
            href={openUrl}
            target="_blank"
            rel="noreferrer noopener"
            title={`Open ${name}`}
            className="block"
          >
            {inner}
          </a>
        ) : (
          inner
        )}
        {onRemove && <RemoveButton onClick={onRemove} name={name} />}
      </div>
    );
  }

  const chipClasses = `relative inline-flex items-center gap-2 rounded-xl bg-neutral-800 border border-neutral-700 pl-2 pr-3 py-2 max-w-[220px] ${
    openUrl ? 'hover:bg-neutral-700/80 transition-colors' : ''
  } ${className}`;

  const inner = (
    <>
      <div className="h-9 w-9 rounded-lg bg-red-600 flex items-center justify-center text-white shrink-0">
        <DocIcon />
      </div>
      <div className="min-w-0 flex flex-col">
        <span className="truncate text-sm text-neutral-100">{name}</span>
        <span className="text-xs text-neutral-400">
          {fileLabel(mime)}
          {typeof bytes === 'number' && bytes > 0 ? ` · ${formatBytes(bytes)}` : ''}
        </span>
      </div>
    </>
  );

  if (openUrl) {
    return (
      <div className="relative inline-block">
        <a
          href={openUrl}
          target="_blank"
          rel="noreferrer noopener"
          title={`Open ${name}`}
          className={chipClasses + ' no-underline'}
        >
          {inner}
        </a>
        {onRemove && <RemoveButton onClick={onRemove} name={name} />}
      </div>
    );
  }

  return (
    <div className={chipClasses}>
      {inner}
      {onRemove && <RemoveButton onClick={onRemove} name={name} />}
    </div>
  );
}

function RemoveButton({ onClick, name }: { onClick: () => void; name: string }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      aria-label={`Remove ${name}`}
      className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-neutral-200 text-neutral-900 text-xs flex items-center justify-center hover:bg-white"
    >
      ×
    </button>
  );
}

function DocIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}
