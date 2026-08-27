#!/usr/bin/env bash
# Build the web target — BUILD-SPEC §4.2.
# Server build with API routes, deployed to Vercel. API base stays empty so the
# browser calls relative /api/... paths.
set -euo pipefail

cd "$(dirname "$0")/.."

export BUILD_TARGET=web
export NEXT_PUBLIC_API_BASE=""

npm run typecheck
npx next build

echo
echo "✅ Web build complete — deploy with: vercel --prod"
