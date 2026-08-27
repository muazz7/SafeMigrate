/**
 * Dual-mode Next config — BUILD-SPEC §4.2.
 *
 * web    (BUILD_TARGET unset|'web') : server build with API routes, deployed to Vercel.
 * native (BUILD_TARGET='native')    : static export to out/, consumed by Capacitor.
 *
 * The APK has no server, so the native build must be a pure static export and every
 * API call resolves to the Vercel origin via NEXT_PUBLIC_API_BASE (see src/lib/api.ts).
 */
const isNative = process.env.BUILD_TARGET === 'native';

/**
 * API route handlers are named `route.api.ts` rather than `route.ts`, and the
 * `api.ts` page extension is registered ONLY for the web build. The native build
 * therefore never resolves them, so `output: 'export'` never tries to collect page
 * data for a server-only route — which fails the build outright.
 *
 * This is what keeps §4.1 true in practice: one set of API routes, living only on
 * Vercel, with the APK shipping a pure static frontend that calls them absolutely.
 */
const pageExtensions = isNative ? ['tsx', 'ts'] : ['tsx', 'ts', 'api.ts'];

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(isNative ? { output: 'export', images: { unoptimized: true } } : {}),
  trailingSlash: isNative,
  pageExtensions,
  typescript: { ignoreBuildErrors: false },
};

export default nextConfig;
