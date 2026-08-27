import type { ApiError } from '@/types';

/**
 * API base URL resolution — BUILD-SPEC §4.1.
 *
 * The backend lives ONLY on Vercel. The web app calls it at relative paths; the APK
 * ships a static export with no server and must call the same endpoints absolutely.
 *
 *   web build    : NEXT_PUBLIC_API_BASE = ''       -> /api/extract
 *   android build: NEXT_PUBLIC_API_BASE = 'https://…' -> https://…/api/extract
 *
 * Never write `fetch('/api/…')` directly anywhere in the app — it silently breaks
 * the APK, where the WebView origin is capacitor://localhost.
 */
const BASE = process.env.NEXT_PUBLIC_API_BASE ?? '';

export const apiUrl = (path: string): string => `${BASE}${path}`;

/** Thrown for any non-2xx response. `userMessageKey` maps into data/strings.json. */
export class ApiRequestError extends Error {
  readonly code: string;
  readonly userMessageKey: string;

  constructor(code: string, userMessageKey: string) {
    super(`${code}: ${userMessageKey}`);
    this.name = 'ApiRequestError';
    this.code = code;
    this.userMessageKey = userMessageKey;
  }
}

const isApiError = (value: unknown): value is ApiError =>
  typeof value === 'object' &&
  value !== null &&
  'error' in value &&
  typeof (value as ApiError).error?.userMessageKey === 'string';

/**
 * Single entry point for every network call in the app.
 * Normalises failures — including CORS and offline errors on native, which must
 * never surface their raw message to the user (BUILD-SPEC §15).
 */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(apiUrl(path), init);
  } catch {
    // Network down, DNS failure, or a CORS rejection on native. Indistinguishable
    // from the client, and all three mean the same thing to the user.
    throw new ApiRequestError('NETWORK_UNAVAILABLE', 'errors.network');
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    if (isApiError(body)) {
      throw new ApiRequestError(body.error.code, body.error.userMessageKey);
    }
    throw new ApiRequestError(`HTTP_${response.status}`, 'errors.generic');
  }

  return body as T;
}
