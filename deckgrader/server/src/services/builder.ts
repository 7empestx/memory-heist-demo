import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import type { DeckSpec } from './bedrock.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BUILD_SCRIPT = path.resolve(__dirname, '../../scripts/build_deck.py');
const OUTPUT_DIR = path.resolve(__dirname, '../../tmp/uploads');
const PYTHON = process.env.PYTHON_BIN ?? 'python3';
const BUILD_TIMEOUT_MS = 30_000;

export class BuildError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BuildError';
  }
}

/** Render a deck spec to a .pptx on disk. Caller must delete the file when done. */
export async function buildDeck(spec: DeckSpec): Promise<string> {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const outputPath = path.join(OUTPUT_DIR, `${randomUUID()}.pptx`);

  return new Promise((resolve, reject) => {
    const child = spawn(PYTHON, [BUILD_SCRIPT, outputPath], {
      stdio: ['pipe', 'ignore', 'pipe'],
    });

    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      settled = true;
      child.kill('SIGKILL');
      reject(new BuildError('Deck rendering timed out after 30 seconds.'));
    }, BUILD_TIMEOUT_MS);

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new BuildError(`Could not start deck renderer: ${err.message}`));
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code === 0) {
        resolve(outputPath);
        return;
      }
      let message = 'Deck rendering failed.';
      try {
        const err = JSON.parse(stderr) as { error?: string };
        if (typeof err.error === 'string') message = err.error;
      } catch {
        // stderr was not JSON; keep the generic message
      }
      reject(new BuildError(message));
    });

    child.stdin.write(JSON.stringify(spec));
    child.stdin.end();
  });
}
