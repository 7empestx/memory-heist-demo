import { useEffect, useState } from 'react';
import { CATEGORY_WEIGHTS } from '../types';

const STEPS = ['Parsing', 'Analyzing structure', 'Scoring'] as const;
const CATEGORIES = Object.keys(CATEGORY_WEIGHTS);

interface Props {
  /** 'uploading' maps to step 0; 'grading' cycles steps 1-2 */
  phase: 'uploading' | 'grading';
}

export default function ProcessingSteps({ phase }: Props) {
  const [flavorIdx, setFlavorIdx] = useState(0);
  const activeStep = phase === 'uploading' ? 0 : flavorIdx % 2 === 0 ? 1 : 2;

  useEffect(() => {
    const timer = setInterval(() => setFlavorIdx((i) => i + 1), 1800);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-col items-center gap-10">
      <ol className="flex items-center gap-4">
        {STEPS.map((step, i) => (
          <li key={step} className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  i < activeStep
                    ? 'bg-accent'
                    : i === activeStep
                      ? 'animate-pulse bg-accent'
                      : 'bg-edge'
                }`}
              />
              <span
                className={`text-sm ${i <= activeStep ? 'text-zinc-200' : 'text-zinc-600'}`}
              >
                {step}
              </span>
            </div>
            {i < STEPS.length - 1 && <span className="h-px w-8 bg-edge" />}
          </li>
        ))}
      </ol>
      <p className="font-mono text-xs text-zinc-500">
        {phase === 'uploading'
          ? 'uploading deck…'
          : `evaluating: ${CATEGORIES[flavorIdx % CATEGORIES.length]}`}
      </p>
    </div>
  );
}
