import { NextResponse } from 'next/server';
import type { ApiError } from '@/types';

/**
 * CORS for the API routes — BUILD-SPEC §4.1.
 *
 * The APK calls these endpoints cross-origin: inside the Android WebView the page
 * origin is `https://localhost` (Capacitor 6 default) or `capacitor://localhost`,
 * never the Vercel domain. Without these headers every native API call fails with
 * an opaque CORS error that surfaces to the user as a bare "network problem".
 *
 * These origins are baked in as defaults rather than left to configuration for
 * exactly that reason — a missing env var must not silently break the APK.
 */
const DEFAULT_ORIGINS = [
  'https://localhost',
  'capacitor://localhost',
  'http://localhost',
  'http://localhost:3000',
];

const allowedOrigins = (): string[] => {
  const configured = process.env.ALLOWED_ORIGINS?.split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  return [...new Set([...DEFAULT_ORIGINS, ...(configured ?? [])])];
};

export function corsHeaders(requestOrigin: string | null): Record<string, string> {
  const allowed = allowedOrigins();
  // Echo the caller's origin when we recognise it. There are no cookies or
  // credentials on these endpoints, so a wildcard would also be safe, but
  // echoing keeps the surface explicit.
  const origin = requestOrigin && allowed.includes(requestOrigin) ? requestOrigin : allowed[0];

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-session-id',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

/** Standard OPTIONS preflight response. Every route must export this. */
export const preflight = (request: Request): Response =>
  new Response(null, { status: 204, headers: corsHeaders(request.headers.get('origin')) });

export const jsonWithCors = <T>(request: Request, body: T, status = 200): NextResponse =>
  NextResponse.json(body, { status, headers: corsHeaders(request.headers.get('origin')) });

/**
 * Typed error response — BUILD-SPEC §15.
 * Full detail is logged server-side; the client only ever receives a code and a
 * strings.json key. Never a raw model output or stack trace.
 */
export function errorWithCors(
  request: Request,
  code: string,
  userMessageKey: string,
  status: number,
  serverDetail?: unknown,
): NextResponse {
  if (serverDetail !== undefined) {
    console.error(`[api] ${code}:`, serverDetail);
  }
  const body: ApiError = { error: { code, userMessageKey } };
  return NextResponse.json(body, {
    status,
    headers: corsHeaders(request.headers.get('origin')),
  });
}
