import { useState } from 'react';
import { fixDeck, downloadBlob, ApiError } from '../api';

interface Props {
  storyline: string[];
  gradeId: string;
}

export default function StorylinePanel({ storyline, gradeId }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (storyline.length === 0) return null;

  const handleDownload = () => {
    setBusy(true);
    setError(null);
    fixDeck(gradeId)
      .then((blob) => downloadBlob(blob, 'fixed-deck.pptx'))
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'Download failed. Please try again.'),
      )
      .finally(() => setBusy(false));
  };

  return (
    <section className="rounded-xl border border-accent/40 bg-accent/5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-accent">
            Fixed storyline
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Read the titles alone — this is the argument your deck should make.
          </p>
        </div>
        <button
          onClick={handleDownload}
          disabled={busy}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-accent-dim disabled:cursor-wait disabled:opacity-60"
        >
          {busy ? 'Rebuilding deck…' : 'Download fixed deck (.pptx)'}
        </button>
      </div>
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      <ol className="mt-5 space-y-3">
        {storyline.map((title, i) => (
          <li key={i} className="flex gap-4">
            <span className="mt-0.5 font-mono text-sm text-accent">
              {String(i + 1).padStart(2, '0')}
            </span>
            <span className="text-zinc-100">{title}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
