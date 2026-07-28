import type { GradeResponse } from './types';

export class ApiError extends Error {}

/**
 * Upload a deck and grade it. Uses XHR so we can tell "uploading" apart from
 * "grading" (server-side parse + Bedrock time) for the step indicator.
 */
export function gradeDeck(file: File, onUploaded: () => void): Promise<GradeResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/grade');
    xhr.responseType = 'json';

    xhr.upload.addEventListener('load', onUploaded);
    xhr.addEventListener('error', () =>
      reject(new ApiError('Network error — is the server running?')),
    );
    xhr.addEventListener('load', () => {
      const body = xhr.response as { message?: string } | GradeResponse | null;
      if (xhr.status >= 200 && xhr.status < 300 && body && 'report' in body) {
        resolve(body);
      } else {
        const message =
          body && 'message' in body && typeof body.message === 'string'
            ? body.message
            : `Request failed (${xhr.status}).`;
        reject(new ApiError(message));
      }
    });

    const form = new FormData();
    form.append('deck', file);
    xhr.send(form);
  });
}

async function fetchDeckFile(url: string, body: unknown): Promise<Blob> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let message = `Request failed (${res.status}).`;
    try {
      const data = (await res.json()) as { message?: string };
      if (typeof data.message === 'string') message = data.message;
    } catch {
      // non-JSON error body; keep generic message
    }
    throw new ApiError(message);
  }
  return res.blob();
}

/** Trigger a browser download of a generated .pptx blob. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Rebuild the graded deck with the report's fixes applied. */
export function fixDeck(gradeId: string): Promise<Blob> {
  return fetchDeckFile('/api/fix', { gradeId });
}

/** Create a consulting-standard deck from a plain-text brief. */
export function generateFromBrief(brief: string): Promise<Blob> {
  return fetchDeckFile('/api/generate', { brief });
}
