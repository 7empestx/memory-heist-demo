import { Router, json, type Request, type Response } from 'express';
import multer from 'multer';
import { mkdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { parseDeck, ParseError, type ParsedDeck } from '../services/parser.js';
import {
  gradeDeck,
  generateFixedDeckSpec,
  generateDeckSpecFromBrief,
  GradingError,
  type GradeReport,
} from '../services/bedrock.js';
import { buildDeck, BuildError } from '../services/builder.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.resolve(__dirname, '../../tmp/uploads');
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const requestLog = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (requestLog.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    requestLog.set(ip, recent);
    return true;
  }
  recent.push(now);
  requestLog.set(ip, recent);
  return false;
}

// Short-lived in-memory store of grade results so /api/fix can rebuild the deck
// without the client re-uploading it. Content stays server-side and expires.
const GRADE_TTL_MS = 15 * 60 * 1000;
interface CachedGrade {
  deck: ParsedDeck;
  report: GradeReport;
  expires: number;
}
const gradeCache = new Map<string, CachedGrade>();

function sweepGradeCache(): void {
  const now = Date.now();
  for (const [id, entry] of gradeCache) {
    if (entry.expires < now) gradeCache.delete(id);
  }
}

const storage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    try {
      await mkdir(UPLOAD_DIR, { recursive: true });
      cb(null, UPLOAD_DIR);
    } catch (err) {
      cb(err as Error, UPLOAD_DIR);
    }
  },
  filename: (_req, _file, cb) => {
    // Never use the client-supplied filename on disk (privacy + path safety).
    cb(null, `${randomUUID()}.pptx`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_BYTES, files: 1 },
});

export const gradeRouter = Router();

gradeRouter.post('/grade', (req: Request, res: Response) => {
  const ip = req.ip ?? 'unknown';
  if (rateLimited(ip)) {
    res.status(429).json({ message: 'Rate limit reached: 10 grades per hour. Try again later.' });
    return;
  }

  upload.single('deck')(req, res, async (uploadErr: unknown) => {
    if (uploadErr) {
      const message =
        uploadErr instanceof multer.MulterError && uploadErr.code === 'LIMIT_FILE_SIZE'
          ? 'File is larger than 25 MB. Please upload a smaller deck.'
          : 'Upload failed. Please try again.';
      res.status(400).json({ message });
      return;
    }

    const file = req.file;
    if (!file) {
      res.status(400).json({ message: 'No file uploaded. Attach a .pptx as the "deck" field.' });
      return;
    }

    try {
      const ext = path.extname(file.originalname).toLowerCase();
      const mimeOk = file.mimetype === PPTX_MIME || file.mimetype === 'application/octet-stream';
      if (ext !== '.pptx' || !mimeOk) {
        res.status(400).json({ message: 'Only .pptx files are supported.' });
        return;
      }

      const deck = await parseDeck(file.path);

      if (deck.slideCount < 2 || deck.deckStats.totalWordCount < 20) {
        res.status(422).json({
          message:
            'Not enough content to grade — the deck needs at least 2 slides with some text. Add your content and try again.',
        });
        return;
      }

      const report = await gradeDeck(deck);

      sweepGradeCache();
      const gradeId = randomUUID();
      gradeCache.set(gradeId, { deck, report, expires: Date.now() + GRADE_TTL_MS });

      res.json({ gradeId, deckStats: deck.deckStats, slideCount: deck.slideCount, report });
    } catch (err) {
      if (err instanceof ParseError) {
        const status = err.kind === 'bad_file' ? 400 : 422;
        res.status(status).json({ message: err.message });
      } else if (err instanceof GradingError) {
        res.status(502).json({
          message: 'The grading service is unavailable right now. Please try again in a minute.',
        });
      } else {
        res.status(500).json({ message: 'Something went wrong. Please try again.' });
      }
    } finally {
      // Always delete the uploaded deck — these may be confidential client decks.
      await unlink(file.path).catch(() => {});
    }
  });
});

async function sendBuiltDeck(res: Response, filePath: string, filename: string): Promise<void> {
  try {
    await new Promise<void>((resolve, reject) => {
      res.download(filePath, filename, (err) => (err ? reject(err) : resolve()));
    });
  } finally {
    await unlink(filePath).catch(() => {});
  }
}

function sendCreationError(res: Response, err: unknown): void {
  if (err instanceof GradingError) {
    res.status(502).json({
      message: 'The deck generation service is unavailable right now. Please try again in a minute.',
    });
  } else if (err instanceof BuildError) {
    res.status(500).json({ message: err.message });
  } else {
    res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
}

/** Rebuild a previously graded deck with the report's fixes applied. */
gradeRouter.post('/fix', json(), async (req: Request, res: Response) => {
  const ip = req.ip ?? 'unknown';
  if (rateLimited(ip)) {
    res.status(429).json({ message: 'Rate limit reached: 10 requests per hour. Try again later.' });
    return;
  }

  const gradeId = (req.body as { gradeId?: unknown } | undefined)?.gradeId;
  if (typeof gradeId !== 'string') {
    res.status(400).json({ message: 'Missing gradeId.' });
    return;
  }

  sweepGradeCache();
  const cached = gradeCache.get(gradeId);
  if (!cached) {
    res.status(410).json({
      message: 'This grade has expired. Re-grade the deck, then download the fixed version.',
    });
    return;
  }

  try {
    const spec = await generateFixedDeckSpec(cached.deck, cached.report);
    const filePath = await buildDeck(spec);
    await sendBuiltDeck(res, filePath, 'fixed-deck.pptx');
  } catch (err) {
    if (!res.headersSent) sendCreationError(res, err);
  }
});

/** Create a consulting-standard deck from a plain-text brief. */
gradeRouter.post('/generate', json(), async (req: Request, res: Response) => {
  const ip = req.ip ?? 'unknown';
  if (rateLimited(ip)) {
    res.status(429).json({ message: 'Rate limit reached: 10 requests per hour. Try again later.' });
    return;
  }

  const brief = (req.body as { brief?: unknown } | undefined)?.brief;
  if (typeof brief !== 'string' || brief.trim().split(/\s+/).length < 5) {
    res.status(400).json({
      message: 'Provide a brief of at least a few sentences: the situation, the audience, and the decision the deck should drive.',
    });
    return;
  }
  if (brief.length > 8000) {
    res.status(400).json({ message: 'Brief is too long — keep it under 8,000 characters.' });
    return;
  }

  try {
    const spec = await generateDeckSpecFromBrief(brief.trim());
    const filePath = await buildDeck(spec);
    await sendBuiltDeck(res, filePath, 'deckgrader-deck.pptx');
  } catch (err) {
    if (!res.headersSent) sendCreationError(res, err);
  }
});
