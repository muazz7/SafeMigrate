#!/usr/bin/env bash
# Build the Android APK — BUILD-SPEC §13.1.
#
# Usage:
#   bash scripts/build-apk.sh            # debug APK (no keystore needed)
#   bash scripts/build-apk.sh release    # signed release APK (needs android/keystore.properties)
set -euo pipefail

cd "$(dirname "$0")/.."
source scripts/android-env.sh

VARIANT="${1:-debug}"

# The APK has no server: the frontend is a static export and calls the Vercel API
# absolutely. Demo mode is compiled in so aeroplane mode still demos (§12.3).
export BUILD_TARGET=native
export NEXT_PUBLIC_API_BASE="${NEXT_PUBLIC_API_BASE:-https://safemigrate.vercel.app}"
export NEXT_PUBLIC_DEMO_MODE=true

echo "▸ Static export (API base: $NEXT_PUBLIC_API_BASE)"
npx next build

echo "▸ Syncing to Android"
npx cap sync android

echo "▸ Gradle assemble${VARIANT^}  (JDK: $(java -version 2>&1 | head -1))"
cd android
if [ "$VARIANT" = "release" ]; then
  ./gradlew assembleRelease
  APK=app/build/outputs/apk/release/app-release.apk
else
  ./gradlew assembleDebug
  APK=app/build/outputs/apk/debug/app-debug.apk
fi

echo
echo "✅ $(cd .. && pwd)/android/$APK"
ls -lh "$APK" | awk '{print "   size: " $5}'
