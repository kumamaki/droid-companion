#!/usr/bin/env bash
# Build a standalone `companion` binary with Bun compile.
# Usage: ./scripts/build-binary.sh [outfile]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-"$ROOT/dist/companion"}"
mkdir -p "$(dirname "$OUT")"

if ! command -v bun >/dev/null 2>&1; then
  echo "error: bun is required to build the binary" >&2
  exit 1
fi

bun build --compile "$ROOT/src/companion.ts" --outfile "$OUT"
echo "built <$OUT>"
