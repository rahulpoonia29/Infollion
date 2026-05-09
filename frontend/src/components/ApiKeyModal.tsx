import { useState } from 'react';

type Props = {
  initialKey?: string;
  onSave: (key: string) => void;
  onClose?: () => void;
};

export default function ApiKeyModal({ initialKey = '', onSave, onClose }: Props) {
  const [value, setValue] = useState(initialKey);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onSave(trimmed);
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-2xl bg-neutral-900 border border-neutral-800 p-6 shadow-xl"
      >
        <h2 className="text-lg font-semibold text-neutral-100">
          Gemini API key
        </h2>
        <p className="mt-1 text-sm text-neutral-400">
          Paste your Google AI Studio API key. It is kept in this browser only and
          sent to the local backend with each request.
        </p>
        <input
          type="password"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="AIza…"
          className="mt-4 w-full rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-2 text-neutral-100 outline-none focus:border-neutral-500"
        />
        <div className="mt-5 flex justify-end gap-2">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={!value.trim()}
            className="rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2 text-sm text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
