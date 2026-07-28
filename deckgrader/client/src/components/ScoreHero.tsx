import { useEffect, useState } from 'react';
import type { GradeReport } from '../types';

const VERDICTS: Record<GradeReport['grade'], string> = {
  A: 'Partner-ready. This deck argues its case.',
  B: 'Strong bones — a focused edit gets this to the boardroom.',
  C: 'The content is there; the argument isn’t. Titles need work.',
  D: 'Information, not persuasion. Rebuild the storyline.',
  F: 'This is a document, not a deck. Start from the pyramid.',
};

export default function ScoreHero({ report }: { report: GradeReport }) {
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    const target = report.overallScore;
    const duration = 900;
    const start = performance.now();
    let frame: number;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayed(Math.round(eased * target));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [report.overallScore]);

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div className="flex items-baseline gap-4">
        <span className="font-mono text-8xl font-bold text-accent">{displayed}</span>
        <span className="rounded-lg border border-edge bg-panel px-4 py-2 font-mono text-4xl font-bold text-white">
          {report.grade}
        </span>
      </div>
      <p className="max-w-md text-zinc-400">{VERDICTS[report.grade]}</p>
    </div>
  );
}
