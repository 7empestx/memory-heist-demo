export default function StorylinePanel({ storyline }: { storyline: string[] }) {
  if (storyline.length === 0) return null;
  return (
    <section className="rounded-xl border border-accent/40 bg-accent/5 p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-accent">
        Fixed storyline
      </h2>
      <p className="mt-1 text-xs text-zinc-500">
        Read the titles alone — this is the argument your deck should make.
      </p>
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
