import { useState } from 'react';
import type { SlideFeedback } from '../types';

export default function SlideAccordion({ feedback }: { feedback: SlideFeedback[] }) {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section className="rounded-xl border border-edge bg-panel">
      <h2 className="border-b border-edge p-6 pb-4 text-sm font-semibold uppercase tracking-wider text-zinc-400">
        Slide-by-slide
      </h2>
      <ul className="divide-y divide-edge">
        {feedback.map((slide) => {
          const isOpen = open === slide.slideIndex;
          const clean = slide.issues.length === 0 && !slide.rewrittenTitle;
          return (
            <li key={slide.slideIndex}>
              <button
                className="flex w-full items-center justify-between px-6 py-3.5 text-left hover:bg-white/5"
                onClick={() => setOpen(isOpen ? null : slide.slideIndex)}
              >
                <span className="flex items-center gap-3">
                  <span className="font-mono text-sm text-zinc-500">
                    S{String(slide.slideIndex).padStart(2, '0')}
                  </span>
                  <span className={`text-sm ${clean ? 'text-zinc-500' : 'text-zinc-200'}`}>
                    {clean
                      ? 'No major issues'
                      : `${slide.issues.length} issue${slide.issues.length === 1 ? '' : 's'}`}
                  </span>
                </span>
                <span className="font-mono text-zinc-500">{isOpen ? '−' : '+'}</span>
              </button>
              {isOpen && (
                <div className="space-y-4 px-6 pb-5 pt-1">
                  {slide.issues.length > 0 && (
                    <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-400">
                      {slide.issues.map((issue, i) => (
                        <li key={i}>{issue}</li>
                      ))}
                    </ul>
                  )}
                  {slide.rewrittenTitle && (
                    <div className="rounded-lg bg-ink p-3 text-sm">
                      <span className="text-zinc-500 line-through">weak title</span>
                      <span className="mx-2 text-zinc-600">→</span>
                      <span className="text-accent">{slide.rewrittenTitle}</span>
                    </div>
                  )}
                  <p className="text-sm text-zinc-300">
                    <span className="font-mono text-xs uppercase text-accent">fix </span>
                    {slide.fix}
                  </p>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
