#!/usr/bin/env bash
# Sourced by the Android build scripts.
#
# Capacitor 6 and the Android Gradle Plugin expect JDK 17. This machine's default
# `java` is 25, so we pin 17 here rather than changing the system default and
# breaking the developer's other projects.

# JDK 17 — override by exporting SAFEMIGRATE_JDK17 before running.
JDK17="${SAFEMIGRATE_JDK17:-/Users/md.muaz/Library/Java/JavaVirtualMachines/ms-17.0.18/Contents/Home}"

if [ ! -x "$JDK17/bin/javac" ]; then
  echo "ERROR: JDK 17 not found at $JDK17" >&2
  echo "Install it (e.g. 'brew install --cask microsoft-openjdk@17') or export SAFEMIGRATE_JDK17." >&2
  echo "Available JVMs:" >&2
  /usr/libexec/java_home -V 2>&1 | sed 's/^/  /' >&2
  exit 1
fi

export JAVA_HOME="$JDK17"

# Android SDK
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"

if [ ! -d "$ANDROID_HOME/platforms" ]; then
  echo "ERROR: Android SDK not found at $ANDROID_HOME" >&2
  exit 1
fi

export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
