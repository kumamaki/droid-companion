#!/usr/bin/env bash
# Build standalone binaries with Bun compile + ship contract.
# Usage:
#   ./scripts/build-binary.sh [outfile]
#   TARGET=bun-darwin-arm64 ./scripts/build-binary.sh dist/droid-companion-darwin-arm64
#   ./scripts/build-binary.sh --multi   # host + common cross targets when supported
#   ./scripts/build-binary.sh --dev-only
# Default host build also emits dist/droid-companion-dev (isolated config+state).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MULTI=0
DEV_ONLY=0
OUT_ARG=""

for arg in "$@"; do
  case "$arg" in
    --multi) MULTI=1 ;;
    --dev-only) DEV_ONLY=1 ;;
    *) OUT_ARG="$arg" ;;
  esac
done

if ! command -v bun >/dev/null 2>&1; then
  echo "error: bun is required to build the binary" >&2
  exit 1
fi

# $1 outfile  $2 optional bun target  $3 entry (default companion.ts)
build_one() {
  local outfile="$1"
  local target="${2:-}"
  local entry="${3:-$ROOT/src/companion.ts}"
  mkdir -p "$(dirname "$outfile")"
  local share_dir
  # Share layout stays under droid-companion for brew; contract content is identical.
  share_dir="$(dirname "$outfile")/share/droid-companion"
  mkdir -p "$share_dir"

  local -a cmd=(bun build --compile "$entry" --outfile "$outfile")
  if [[ -n "$target" ]]; then
    cmd+=(--target "$target")
  elif [[ -n "${TARGET:-}" ]]; then
    cmd+=(--target "$TARGET")
  fi

  echo "building <${outfile}> entry=<${entry}>${target:+ target=<$target>}${TARGET:+ TARGET=<$TARGET>}"
  "${cmd[@]}"
  cp "$ROOT/contract/contract.md" "$share_dir/contract.md"
  echo "built <$outfile>"
  echo "contract <$share_dir/contract.md>"
}

if [[ "$MULTI" -eq 1 ]]; then
  # Best-effort multi-arch artifacts for GH Releases. Failures on unsupported
  # host/cross combos are reported but do not block the host binary.
  mkdir -p "$ROOT/dist"
  build_one "$ROOT/dist/droid-companion" "" "$ROOT/src/companion.ts"
  build_one "$ROOT/dist/droid-companion-dev" "" "$ROOT/src/companion-dev.ts"
  HOST="$(uname -s)-$(uname -m)"
  echo "host platform <$HOST>"
  # Bun compile targets (names per bun build --help); skip unknown quietly.
  for pair in \
    "bun-darwin-arm64:droid-companion-darwin-arm64" \
    "bun-darwin-x64:droid-companion-darwin-x64" \
    "bun-linux-x64:droid-companion-linux-x64" \
    "bun-linux-arm64:droid-companion-linux-arm64"
  do
    t="${pair%%:*}"
    name="${pair##*:}"
    if [[ -z "$OUT_ARG" || "$OUT_ARG" == *"$name"* || "$OUT_ARG" == "all" ]]; then
      if ! build_one "$ROOT/dist/$name" "$t" "$ROOT/src/companion.ts"; then
        echo "warn: skipped target <$t> (unsupported on this host?)" >&2
      fi
    fi
  done
  ls -la "$ROOT/dist" || true
  exit 0
fi

if [[ "$DEV_ONLY" -eq 1 ]]; then
  OUT="${OUT_ARG:-"$ROOT/dist/droid-companion-dev"}"
  build_one "$OUT" "" "$ROOT/src/companion-dev.ts"
  exit 0
fi

if [[ -n "$OUT_ARG" ]]; then
  # Explicit outfile: single prod entry (release / custom path)
  build_one "$OUT_ARG" "" "$ROOT/src/companion.ts"
  exit 0
fi

# Default: host prod + dev binaries
build_one "$ROOT/dist/droid-companion" "" "$ROOT/src/companion.ts"
build_one "$ROOT/dist/droid-companion-dev" "" "$ROOT/src/companion-dev.ts"
