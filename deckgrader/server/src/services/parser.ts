import { spawn } from 'node:child_process';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PARSE_SCRIPT = path.resolve(__dirname, '../../scripts/parse_deck.py');
const PYTHON = process.env.PYTHON_BIN ?? 'python3';

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_SLIDES = 60;
const PARSE_TIMEOUT_MS = 30_000;

export interface SlideShapeCounts {
  textBoxes: number;
  images: number;
  charts: number;
  tables: number;
}

export interface ParsedSlide {
  index: number;
  title: string | null;
  bodyText: string[];
  notes: string | null;
  shapeCounts: SlideShapeCounts;
  wordCount: number;
  bulletDepthMax: number;
  hasTitlePlaceholder: boolean;
  fontSizesUsed: number[];
  distinctFonts: string[];
}

export interface DeckStats {
  totalWordCount: number;
  avgWordsPerSlide: number;
  distinctFontsCount: number;
  slidesMissingTitles: number;
}

export interface ParsedDeck {
  slideCount: number;
  slides: ParsedSlide[];
  deckStats: DeckStats;
}

export class ParseError extends Error {
  constructor(
    message: string,
    public readonly kind: 'bad_file' | 'unparseable',
  ) {
    super(message);
    this.name = 'ParseError';
  }
}

function isParsedDeck(value: unknown): value is ParsedDeck {
  if (typeof value !== 'object' || value === null) return false;
  const deck = value as Record<string, unknown>;
  return (
    typeof deck.slideCount === 'number' &&
    Array.isArray(deck.slides) &&
    typeof deck.deckStats === 'object' &&
    deck.deckStats !== null
  );
}

export async function parseDeck(filePath: string): Promise<ParsedDeck> {
  const info = await stat(filePath);
  if (info.size > MAX_FILE_BYTES) {
    throw new ParseError('File is larger than 25 MB. Please upload a smaller deck.', 'bad_file');
  }

  const { stdout, stderr, code } = await runPython(filePath);

  if (code !== 0) {
    let message = 'The file could not be parsed as a PowerPoint deck.';
    try {
      const err = JSON.parse(stderr) as { error?: string };
      if (typeof err.error === 'string') message = err.error;
    } catch {
      // stderr was not JSON; keep the generic message
    }
    throw new ParseError(message, 'unparseable');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new ParseError('Deck parser returned malformed output.', 'unparseable');
  }
  if (!isParsedDeck(parsed)) {
    throw new ParseError('Deck parser returned an unexpected shape.', 'unparseable');
  }

  if (parsed.slideCount > MAX_SLIDES) {
    throw new ParseError(
      `Deck has ${parsed.slideCount} slides; the limit is ${MAX_SLIDES}. Trim the deck and try again.`,
      'bad_file',
    );
  }

  return parsed;
}

function runPython(
  filePath: string,
): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve, reject) => {
    const child = spawn(PYTHON, [PARSE_SCRIPT, filePath], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      settled = true;
      child.kill('SIGKILL');
      reject(new ParseError('Deck parsing timed out after 30 seconds.', 'unparseable'));
    }, PARSE_TIMEOUT_MS);

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new ParseError(`Could not start deck parser: ${err.message}`, 'unparseable'));
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ stdout, stderr, code });
    });
  });
}
