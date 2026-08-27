import { platform } from '@/lib/platform';

/**
 * Session persistence — BUILD-SPEC §14 Day 2.5.
 *
 * The app has no accounts. A session is an opaque UUID held on the device and
 * sent as `x-session-id`; the server ties documents to it. Storage goes through
 * `platform` so native uses @capacitor/preferences (localStorage in a WebView can
 * be evicted by the OS) — never touch localStorage directly here.
 */

const SESSION_KEY = 'safemigrate.session_id';

/** RFC 4122 v4. `crypto.randomUUID` needs a secure context and a recent WebView;
 *  older Android builds reach the fallback. */
function uuidv4(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10
    const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  throw new Error('No secure random source available for session id');
}

let cached: string | null = null;

/** Returns the device's session id, creating and persisting one on first use. */
export async function getSessionId(): Promise<string> {
  if (cached) return cached;

  const existing = await platform.getItem(SESSION_KEY);
  if (existing) {
    cached = existing;
    return existing;
  }

  const created = uuidv4();
  await platform.setItem(SESSION_KEY, created);
  cached = created;
  return created;
}

/** Backs the Vault's "delete everything" control (§16.4). */
export async function clearSession(): Promise<void> {
  cached = null;
  await platform.removeItem(SESSION_KEY);
}
