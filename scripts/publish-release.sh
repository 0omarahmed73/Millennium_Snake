#!/usr/bin/env bash
# Publishes the signed Android build in release/ as a GitHub Release.
# Usage: scripts/publish-release.sh 1.3
# Assets are uploaded without the version in their names, so the README's
# .../releases/latest/download/MillenniumSnake-universal-release.apk links always
# point at the newest build.
set -euo pipefail

VERSION="${1:?usage: scripts/publish-release.sh <version, e.g. 1.3>}"
REPO="0omarahmed73/Millennium_Snake"
SRC="release"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

shopt -s nullglob
files=("$SRC"/MillenniumSnake-"$VERSION"-*)
if [ ${#files[@]} -eq 0 ]; then
  echo "No files matching $SRC/MillenniumSnake-$VERSION-* (build the release first)." >&2
  exit 1
fi
for f in "${files[@]}"; do
  name="$(basename "$f")"
  cp "$f" "$STAGE/${name/-$VERSION/}"
done

gh release create "v$VERSION" "$STAGE"/* \
  --repo "$REPO" \
  --target main \
  --title "Millennium Snake $VERSION" \
  --notes "Signed Android release $VERSION.

- **MillenniumSnake-universal-release.apk**: any Android phone (recommended)
- **MillenniumSnake-arm64-v8a-release.apk**: most modern phones
- **MillenniumSnake-armeabi-v7a-release.apk**: older 32-bit phones
- **MillenniumSnake-x86_64 / x86-release.apk**: emulators and x86 devices
- **MillenniumSnake-release.aab**: Google Play upload

Requires Android 7.0+. Allow *Install unknown apps* when sideloading.
Play in the browser: https://millennium-snake.vercel.app"

echo "Published: https://github.com/$REPO/releases/tag/v$VERSION"
