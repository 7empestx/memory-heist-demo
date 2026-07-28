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
