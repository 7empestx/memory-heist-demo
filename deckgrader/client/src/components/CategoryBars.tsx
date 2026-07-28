import type { CategoryScore } from '../types';
import { CATEGORY_WEIGHTS } from '../types';

export default function CategoryBars({ scores }: { scores: CategoryScore[] }) {
  return (
    <section className="rounded-xl border border-edge bg-panel p-6">
      <h2 className="mb-5 text-sm font-semibold uppercase tracking-wider text-zinc-400">
        Category breakdown
      </h2>
      <ul className="space-y-5">
        {scores.map((c) => (
          <li key={c.category}>
            <div className="mb-1.5 flex items-baseline justify-between gap-4">
              <span className="text-sm text-zinc-200">
                {c.category}
                {CATEGORY_WEIGHTS[c.category] !== undefined && (
                  <span className="ml-2 font-mono text-xs text-zinc-500">
                    {CATEGORY_WEIGHTS[c.category]}%
                  </span>
                )}
              </span>
              <span className="font-mono text-sm text-accent">{c.score}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-edge">
              <div
                className="h-full rounded-full bg-accent transition-all duration-700"
                style={{ width: `${Math.max(2, Math.min(100, c.score))}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-zinc-500">{c.summary}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
