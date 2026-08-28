import { platform } from '@/lib/platform';
import type { ExtractedContract } from '@/lib/schema';
import type { AnalysisResult, DocType } from '@/types';

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

// ---------------------------------------------------------------------------
// Analysis results
// ---------------------------------------------------------------------------

/**
 * A completed analysis, held on the device so the results screen can be reopened,
 * shared as a link within the app, and survive a refresh.
 *
 * The rules engine is pure and runs identically in the WebView, so the analysis is
 * computed on the client and stored here rather than fetched back from the server.
 * That is what lets a result stay readable with the radio off — which matters both
 * for the aeroplane-mode demo (§12) and for a user out of data credit.
 *
 * The document image is deliberately NOT stored here: it is large, and the uploaded
 * copy already lives in the private Storage bucket.
 */
export interface StoredAnalysis {
  id: string;
  createdAt: string;
  documentId: string;
  extractionId: string;
  docType: DocType;
  confidence: number;
  contract: ExtractedContract;
  result: AnalysisResult;
  /** Prefills the Agency Verifier deep link from the results screen. */
  agencyQuery: string | null;
  feeBdt: number | null;
}

const analysisKey = (id: string): string => `safemigrate.analysis.${id}`;
const INDEX_KEY = 'safemigrate.analysis.index';

/** Newest first. Backs the Vault list on Day 8. */
export async function analysisIndex(): Promise<string[]> {
  const raw = await platform.getItem(INDEX_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

export async function saveAnalysis(analysis: StoredAnalysis): Promise<void> {
  await platform.setItem(analysisKey(analysis.id), JSON.stringify(analysis));

  const index = await analysisIndex();
  const next = [analysis.id, ...index.filter((id) => id !== analysis.id)];
  await platform.setItem(INDEX_KEY, JSON.stringify(next));
}

export async function loadAnalysis(id: string): Promise<StoredAnalysis | null> {
  const raw = await platform.getItem(analysisKey(id));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredAnalysis;
  } catch {
    return null; // Corrupt entry — the UI shows the "no longer available" state.
  }
}

export async function deleteAnalysis(id: string): Promise<void> {
  await platform.removeItem(analysisKey(id));
  const index = await analysisIndex();
  await platform.setItem(INDEX_KEY, JSON.stringify(index.filter((entry) => entry !== id)));
}
