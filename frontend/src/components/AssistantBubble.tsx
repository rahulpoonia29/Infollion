import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { StreamPhase } from '../types';

type Props = {
  text: string;
  phase: StreamPhase;
};

export default function AssistantBubble({ text, phase }: Props) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  const showStatus = !text && (phase === 'sending' || phase === 'waiting');

  return (
    <div className="group max-w-[85%] flex flex-col gap-1">
      <div className="markdown">
        {text ? (
          <>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
            {phase === 'streaming' && (
              <span className="ml-0.5 inline-block h-4 w-0.5 align-middle bg-neutral-300 animate-pulse" />
            )}
          </>
        ) : showStatus ? (
          <PhaseIndicator phase={phase} />
        ) : null}
      </div>
      {!phase && text && (
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={copy}
            className="text-xs text-neutral-500 hover:text-neutral-200 inline-flex items-center gap-1 cursor-pointer"
            aria-label="Copy reply"
          >
            <CopyIcon />
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      )}
    </div>
  );
}

function PhaseIndicator({ phase }: { phase: StreamPhase }) {
  if (phase === 'sending') {
    return (
      <div className="flex items-center gap-2 text-neutral-400 text-sm py-1">
        <Spinner />
        <span>Sending…</span>
      </div>
    );
  }
  if (phase === 'waiting') {
    return (
      <div className="flex items-center gap-2 text-neutral-400 text-sm py-1">
        <Dots />
        <span>Generating reply</span>
      </div>
    );
  }
  return null;
}

function Dots() {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-1.5 w-1.5 rounded-full bg-neutral-400 animate-pulse" />
      <span className="h-1.5 w-1.5 rounded-full bg-neutral-400 animate-pulse [animation-delay:120ms]" />
      <span className="h-1.5 w-1.5 rounded-full bg-neutral-400 animate-pulse [animation-delay:240ms]" />
    </span>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 0 1-9 9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}
