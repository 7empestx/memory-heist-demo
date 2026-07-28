import { useCallback, useRef, useState } from 'react';

interface Props {
  onFile: (file: File) => void;
}

export default function UploadZone({ onFile }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [rejected, setRejected] = useState<string | null>(null);

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
    </div>
  );
}
