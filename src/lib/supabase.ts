import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase access — BUILD-SPEC §5.
 *
 * Only ever imported by server-side API routes. The service-role key must never
 * reach the browser or the APK bundle, so it is read from a non-NEXT_PUBLIC var
 * and this module throws if imported into client code.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let cached: SupabaseClient | null = null;

/** Server-only client. Returns null when Supabase is not configured, so the app
 *  can degrade to local-only rather than crash (§15: "continue local-only"). */
export function getServerSupabase(): SupabaseClient | null {
  if (typeof window !== 'undefined') {
    throw new Error('getServerSupabase() must never be called from client code');
  }
  if (!url || !serviceKey) return null;
  if (cached) return cached;

  cached = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

export const isSupabaseConfigured = (): boolean => Boolean(url && serviceKey);

/** Private bucket holding the uploaded documents. Never public (§16.1). */
export const DOCUMENTS_BUCKET = 'documents';

/** Signed URL lifetime in seconds (§5.2). */
export const SIGNED_URL_TTL = 60 * 60;
