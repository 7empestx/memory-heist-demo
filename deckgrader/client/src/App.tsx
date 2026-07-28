import { useCallback, useState } from 'react';
import { gradeDeck, ApiError } from './api';
import type { GradeResponse } from './types';
import UploadZone from './components/UploadZone';
import ProcessingSteps from './components/ProcessingSteps';
import ScoreHero from './components/ScoreHero';
import CategoryBars from './components/CategoryBars';
import StorylinePanel from './components/StorylinePanel';
import SlideAccordion from './components/SlideAccordion';

type State =
  | { phase: 'idle' }
  | { phase: 'uploading' }
  | { phase: 'grading' }
  | { phase: 'done'; result: GradeResponse }
  | { phase: 'error'; message: string };

export default function App() {
  const [state, setState] = useState<State>({ phase: 'idle' });

  const handleFile = useCallback((file: File) => {
    setState({ phase: 'uploading' });
    gradeDeck(file, () => setState({ phase: 'grading' }))
      .then((result) => setState({ phase: 'done', result }))
      .catch((err: unknown) => {
        const message =
          err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
        setState({ phase: 'error', message });
      });
  }, []);

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-10">
      {state.phase === 'idle' && (
        <main className="flex flex-1 items-center justify-center">
          <UploadZone onFile={handleFile} />
        </main>
      )}

      {(state.phase === 'uploading' || state.phase === 'grading') && (
        <main className="flex flex-1 items-center justify-center">
          <ProcessingSteps phase={state.phase} />
        </main>
      )}

      {state.phase === 'error' && (
        <main className="flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="rounded-xl border border-red-900/60 bg-red-950/30 px-6 py-4 text-red-300">
              {state.message}
            </div>
            <button
              className="rounded-lg border border-edge bg-panel px-5 py-2.5 text-sm text-zinc-200 hover:border-accent hover:text-accent"
              onClick={() => setState({ phase: 'idle' })}
            >
              Try again
            </button>
          </div>
        </main>
      )}

      {state.phase === 'done' && (
        <main className="space-y-8 py-6">
          <header className="flex items-center justify-between">
            <span className="font-mono text-sm text-zinc-500">
              Deck<span className="text-accent">Grader</span> · {state.result.slideCount} slides ·{' '}
              {state.result.deckStats.avgWordsPerSlide} words/slide
            </span>
            <button
              className="rounded-lg border border-edge bg-panel px-4 py-2 text-sm text-zinc-200 hover:border-accent hover:text-accent"
              onClick={() => setState({ phase: 'idle' })}
            >
              Grade another deck
            </button>
          </header>

          <ScoreHero report={state.result.report} />

          {state.result.report.topStrengths.length > 0 && (
            <section className="rounded-xl border border-edge bg-panel p-6">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">
                What works
              </h2>
              <ul className="space-y-1.5 text-sm text-zinc-300">
                {state.result.report.topStrengths.map((s, i) => (
                  <li key={i}>· {s}</li>
                ))}
              </ul>
            </section>
          )}

          <StorylinePanel storyline={state.result.report.storylineRewrite} />

          {state.result.report.criticalIssues.length > 0 && (
            <section className="rounded-xl border border-red-900/50 bg-red-950/20 p-6">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-red-400">
                Critical issues
              </h2>
              <ol className="space-y-2 text-sm text-zinc-300">
                {state.result.report.criticalIssues.map((issue, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="font-mono text-red-400">{i + 1}.</span>
                    {issue}
                  </li>
                ))}
              </ol>
            </section>
          )}

          <CategoryBars scores={state.result.report.categoryScores} />
          <SlideAccordion feedback={state.result.report.slideFeedback} />
        </main>
      )}
    </div>
  );
}
