#!/usr/bin/env bash
# Remove local build artifacts (never touches sessions / state home).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
rm -rf "$ROOT/dist"
rm -f /tmp/droid-companion-typecheck.js
echo "cleaned dist/ and typecheck temp artifact"
