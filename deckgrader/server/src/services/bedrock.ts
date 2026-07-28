import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { serializeRubricForPrompt, CATEGORY_WEIGHTS } from '../rubric/consulting-rubric.js';
import type { ParsedDeck, ParsedSlide } from './parser.js';

// All model access goes through this module so the model is swappable.
const MODEL_ID = process.env.BEDROCK_MODEL_ID ?? 'anthropic.claude-sonnet-4-6';
const MAX_TOKENS = 4096;
const TEMPERATURE = 0.2;
const TRUNCATE_THRESHOLD_SLIDES = 25;
const TRUNCATE_BODY_WORDS = 60;

// Credentials come from the default AWS credential chain — never hardcoded.
const client = new BedrockRuntimeClient({
  region: process.env.AWS_REGION ?? 'us-east-1',
});

export interface CategoryScore {
  category: string;
  score: number;
  summary: string;
}

export interface SlideFeedback {
  slideIndex: number;
  issues: string[];
  rewrittenTitle: string | null;
  fix: string;
}

export interface GradeReport {
  overallScore: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  categoryScores: CategoryScore[];
  topStrengths: string[];
  criticalIssues: string[];
  slideFeedback: SlideFeedback[];
  storylineRewrite: string[];
}

export class GradingError extends Error {
  constructor(
    message: string,
    public readonly kind: 'bedrock_call' | 'bad_model_output',
  ) {
    super(message);
    this.name = 'GradingError';
  }
}

function buildSystemPrompt(): string {
  const weights = CATEGORY_WEIGHTS.map((w) => `${w.name} (${w.percent}%)`).join(', ');
  return [
    'You are DeckGrader, an expert presentation reviewer trained on McKinsey, BCG, and Bain deck standards.',
    'You grade PowerPoint decks against the rubric below. Score each category 0-100 using the 1/3/5 anchors',
    '(1 maps to ~20, 3 to ~60, 5 to ~95; interpolate). The overall score is the weighted average of the',
    `category scores using these weights: ${weights}.`,
    'Letter grade: A >= 88, B >= 75, C >= 60, D >= 45, F below 45.',
    '',
    'Be a demanding partner-level reviewer. A deck of label titles and text walls must land in D/F territory;',
    'a deck whose titles alone tell a complete quantified argument ending in a recommendation deserves an A.',
    'Ground every judgment in the anchors — do not grade on general "looks fine" impressions.',
    '',
    '# Rubric',
    serializeRubricForPrompt(),
    '# Output',
    'Respond with ONLY a JSON object — no markdown fences, no commentary before or after. Schema:',
    JSON.stringify({
      overallScore: '0-100 integer',
      grade: 'A|B|C|D|F',
      categoryScores: [
        { category: 'exact rubric category name', score: '0-100 integer', summary: '1-2 sentence assessment' },
      ],
      topStrengths: ['max 3 strings'],
      criticalIssues: ['max 5 strings, ordered by impact'],
      slideFeedback: [
        {
          slideIndex: 1,
          issues: ['specific problems on this slide'],
          rewrittenTitle: 'action-title rewrite if the title is weak, else null',
          fix: 'single highest-impact fix for this slide',
        },
      ],
      storylineRewrite: [
        'ordered list of action titles that WOULD tell the story — the deck’s horizontal logic, fixed',
      ],
    }),
    '',
    'Rules: include a slideFeedback entry for every slide. categoryScores must have exactly one entry per',
    'rubric category, using the exact category names. storylineRewrite must read as a complete argument:',
    'each title a full-sentence claim, ordered so the titles alone tell the story, ending with the recommendation.',
  ].join('\n');
}

/** For big decks, truncate bodyText to stay in the token budget. Titles are never truncated. */
function prepareDeckForPrompt(deck: ParsedDeck): ParsedDeck {
  if (deck.slideCount <= TRUNCATE_THRESHOLD_SLIDES) return deck;
  const slides: ParsedSlide[] = deck.slides.map((slide) => {
    let budget = TRUNCATE_BODY_WORDS;
    const bodyText: string[] = [];
    for (const text of slide.bodyText) {
      if (budget <= 0) break;
      const words = text.split(/\s+/);
      if (words.length <= budget) {
        bodyText.push(text);
        budget -= words.length;
      } else {
        bodyText.push(words.slice(0, budget).join(' ') + ' …');
        budget = 0;
      }
    }
    return { ...slide, bodyText };
  });
  return { ...deck, slides };
}

function stripCodeFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();
}

function isGradeReport(value: unknown): value is GradeReport {
  if (typeof value !== 'object' || value === null) return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.overallScore === 'number' &&
    typeof r.grade === 'string' &&
    ['A', 'B', 'C', 'D', 'F'].includes(r.grade) &&
    Array.isArray(r.categoryScores) &&
    Array.isArray(r.topStrengths) &&
    Array.isArray(r.criticalIssues) &&
    Array.isArray(r.slideFeedback) &&
    Array.isArray(r.storylineRewrite)
  );
}

interface BedrockMessage {
  role: 'user' | 'assistant';
  content: string;
}

async function invokeModel(system: string, messages: BedrockMessage[]): Promise<string> {
  const command = new InvokeModelCommand({
    modelId: MODEL_ID,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE,
      system,
      messages,
    }),
  });

  let response;
  try {
    response = await client.send(command);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    throw new GradingError(`Bedrock call failed: ${message}`, 'bedrock_call');
  }

  const payload = JSON.parse(new TextDecoder().decode(response.body)) as {
    content?: Array<{ type: string; text?: string }>;
    stop_reason?: string;
  };
  const text = (payload.content ?? [])
    .filter((block) => block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('');
  if (!text) {
    throw new GradingError('Model returned no text content.', 'bad_model_output');
  }
  return text;
}

function parseReport(raw: string): GradeReport | null {
  try {
    const parsed: unknown = JSON.parse(stripCodeFences(raw));
    return isGradeReport(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Dev-only mock (DECKGRADER_MOCK_BEDROCK=1): a deterministic heuristic report
 * derived from parser signals, for exercising the full pipeline and UI without
 * AWS credentials. Real grading always goes through Bedrock.
 */
function mockReport(deck: ParsedDeck): GradeReport {
  const isActionTitle = (t: string | null): boolean =>
    !!t && t.split(/\s+/).length >= 6 && /[a-z]/.test(t);
  const actionTitleRatio =
    deck.slides.filter((s) => isActionTitle(s.title)).length / deck.slideCount;
  const wallOfTextCount = deck.slides.filter((s) => s.wordCount > 120).length;
  const deepBullets = deck.slides.filter((s) => s.bulletDepthMax > 2).length;
  const lastTitle = deck.slides[deck.slides.length - 1]?.title ?? '';
  const endsWithRecommendation = /recommend|next step|decision|ask|proposal/i.test(lastTitle);
  const clamp = (n: number) => Math.max(5, Math.min(97, Math.round(n)));

  const storyline = clamp(25 + actionTitleRatio * 60 + (endsWithRecommendation ? 10 : 0));
  const titles = clamp(15 + actionTitleRatio * 80);
  const evidence = clamp(30 + actionTitleRatio * 45);
  const craft = clamp(
    90 - (wallOfTextCount / deck.slideCount) * 60 - (deepBullets / deck.slideCount) * 30,
  );
  const audience = clamp(endsWithRecommendation ? 85 : 25);
  const overall = Math.round(
    storyline * 0.3 + titles * 0.25 + evidence * 0.2 + craft * 0.15 + audience * 0.1,
  );
  const grade =
    overall >= 88 ? 'A' : overall >= 75 ? 'B' : overall >= 60 ? 'C' : overall >= 45 ? 'D' : 'F';

  return {
    overallScore: overall,
    grade,
    categoryScores: [
      { category: 'Storyline & Structure', score: storyline, summary: '[mock] Scored from title signals.' },
      { category: 'Action Titles & So-What', score: titles, summary: '[mock] Scored from action-title ratio.' },
      { category: 'Evidence & Data Integrity', score: evidence, summary: '[mock] Heuristic estimate.' },
      { category: 'Visual Hierarchy & Slide Craft', score: craft, summary: '[mock] Scored from word counts and bullet depth.' },
      { category: 'Audience & Recommendation Fit', score: audience, summary: '[mock] Scored from closing slide.' },
    ],
    topStrengths: ['[mock] Deterministic development report — set AWS credentials for real grading.'],
    criticalIssues: deck.slides
      .filter((s) => !isActionTitle(s.title) || s.wordCount > 120)
      .slice(0, 5)
      .map((s) => `[mock] Slide ${s.index}: ${!isActionTitle(s.title) ? 'label title' : 'wall of text'}.`),
    slideFeedback: deck.slides.map((s) => ({
      slideIndex: s.index,
      issues: [
        ...(!isActionTitle(s.title) ? ['Title is a label, not a claim.'] : []),
        ...(s.wordCount > 120 ? [`${s.wordCount} words — over the ~100-word guideline.`] : []),
        ...(s.bulletDepthMax > 2 ? [`Bullets nested ${s.bulletDepthMax} levels deep.`] : []),
      ],
      rewrittenTitle: isActionTitle(s.title) ? null : `[mock rewrite] Slide ${s.index} needs a full-sentence claim`,
      fix: '[mock] Rewrite the title as a quantified claim and cut body text to what proves it.',
    })),
    storylineRewrite: deck.slides.map(
      (s) => (isActionTitle(s.title) ? s.title! : `[mock] Replace "${s.title ?? 'untitled'}" with an action title`),
    ),
  };
}

export async function gradeDeck(deck: ParsedDeck): Promise<GradeReport> {
  if (process.env.DECKGRADER_MOCK_BEDROCK === '1') {
    return mockReport(deck);
  }

  const system = buildSystemPrompt();
  const deckJson = JSON.stringify(prepareDeckForPrompt(deck));
  const messages: BedrockMessage[] = [
    { role: 'user', content: `Grade this deck:\n${deckJson}` },
  ];

  const firstAttempt = await invokeModel(system, messages);
  let report = parseReport(firstAttempt);
  if (report) return report;

  // Retry once with an explicit valid-JSON reminder, then fail with a typed error.
  const retry = await invokeModel(system, [
    ...messages,
    { role: 'assistant', content: firstAttempt },
    {
      role: 'user',
      content:
        'Your previous response was not valid JSON matching the required schema. Return ONLY the valid JSON object now — no markdown fences, no commentary.',
    },
  ]);
  report = parseReport(retry);
  if (report) return report;

  throw new GradingError('Model did not return a valid grading report.', 'bad_model_output');
}
