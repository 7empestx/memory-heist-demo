import { useCallback, useRef, useState } from 'react';
import { generateFromBrief, downloadBlob, ApiError } from '../api';

interface Props {
  onFile: (file: File) => void;
}

export default function UploadZone({ onFile }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [rejected, setRejected] = useState<string | null>(null);
  const [briefOpen, setBriefOpen] = useState(false);
  const [brief, setBrief] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const handleGenerate = () => {
    setGenerating(true);
    setGenerateError(null);
    generateFromBrief(brief)
      .then((blob) => downloadBlob(blob, 'deckgrader-deck.pptx'))
      .catch((err: unknown) =>
        setGenerateError(
          err instanceof ApiError ? err.message : 'Generation failed. Please try again.',
        ),
      )
      .finally(() => setGenerating(false));
  };

  const accept = useCallback(
    (file: File | undefined) => {
      if (!file) return;
      if (!file.name.toLowerCase().endsWith('.pptx')) {
        setRejected('Only .pptx files are supported.');
        return;
      }
      setRejected(null);
      onFile(file);
    },
    [onFile],
  );

  return (
    <div className="flex flex-col items-center gap-8 text-center">
      <div>
        <h1 className="text-4xl font-bold tracking-tight text-white">
          Deck<span className="text-accent">Grader</span>
        </h1>
        <p className="mt-3 text-zinc-400">
          Score your deck against McKinsey-tier standards.
        </p>
      </div>

      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          accept(e.dataTransfer.files[0]);
        }}
        className={`w-full max-w-xl cursor-pointer rounded-xl border-2 border-dashed p-14 transition-colors ${
          dragging ? 'border-accent bg-accent/5' : 'border-edge bg-panel hover:border-zinc-500'
        }`}
      >
        <div className="font-mono text-sm text-zinc-500">.pptx</div>
        <p className="mt-2 text-lg text-zinc-200">
          Drop your deck here <span className="text-zinc-500">or click to browse</span>
        </p>
        <p className="mt-2 text-xs text-zinc-500">Max 25 MB · 60 slides · deleted after grading</p>
        <input
          ref={inputRef}
          type="file"
          accept=".pptx"
          className="hidden"
          onChange={(e) => accept(e.target.files?.[0])}
        />
      </div>

      {rejected && <p className="text-sm text-red-400">{rejected}</p>}

      <div className="w-full max-w-xl">
        {!briefOpen ? (
          <button
            className="text-sm text-zinc-500 underline-offset-4 hover:text-accent hover:underline"
            onClick={() => setBriefOpen(true)}
          >
            No deck yet? Create one from a brief →
          </button>
        ) : (
          <div className="rounded-xl border border-edge bg-panel p-5 text-left">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
              Create a deck from a brief
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              Describe the situation, the audience, and the decision the deck should drive.
            </p>
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              rows={4}
              placeholder="e.g. Our SMB churn doubled this year. Pitch the exec committee on funding a 2-person onboarding team; pilot data shows churn halves when onboarding completes…"
              className="mt-3 w-full rounded-lg border border-edge bg-ink p-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-accent focus:outline-none"
            />
            <div className="mt-3 flex items-center gap-4">
              <button
                onClick={handleGenerate}
                disabled={generating || brief.trim().split(/\s+/).length < 5}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-accent-dim disabled:cursor-not-allowed disabled:opacity-50"
              >
                {generating ? 'Generating…' : 'Generate deck (.pptx)'}
              </button>
              <button
                className="text-sm text-zinc-500 hover:text-zinc-300"
                onClick={() => setBriefOpen(false)}
              >
                Cancel
              </button>
            </div>
            {generateError && <p className="mt-3 text-sm text-red-400">{generateError}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
