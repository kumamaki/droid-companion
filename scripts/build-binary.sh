#!/usr/bin/env bash
# Build a standalone `companion` binary with Bun compile + ship contract.
# Usage: ./scripts/build-binary.sh [outfile]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-"$ROOT/dist/companion"}"
mkdir -p "$(dirname "$OUT")"
SHARE_DIR="$(dirname "$OUT")/share/droid-companion"
mkdir -p "$SHARE_DIR"

if ! command -v bun >/dev/null 2>&1; then
  echo "error: bun is required to build the binary" >&2
  exit 1
fi

bun build --compile "$ROOT/src/companion.ts" --outfile "$OUT"
cp "$ROOT/contract/contract.md" "$SHARE_DIR/contract.md"
echo "built <$OUT>"
echo "contract <$SHARE_DIR/contract.md>"
