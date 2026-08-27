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

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(isNative ? { output: 'export', images: { unoptimized: true } } : {}),
  trailingSlash: isNative,
  typescript: { ignoreBuildErrors: false },
};

export default nextConfig;
