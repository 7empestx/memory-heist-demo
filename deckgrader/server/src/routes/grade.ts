import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import { mkdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { parseDeck, ParseError } from '../services/parser.js';
import { gradeDeck, GradingError } from '../services/bedrock.js';

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
      res.json({ deckStats: deck.deckStats, slideCount: deck.slideCount, report });
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
