#!/usr/bin/env bash
# Prepare a release: version sync check, tests optional, build, print next steps.
# Does NOT push, tag, or edit the homebrew tap (agent/user policy: no push).
#
# Usage:
#   ./scripts/release.sh              # check + build host binary
#   ./scripts/release.sh --skip-tests
#   ./scripts/release.sh --multi      # multi-arch best-effort
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SKIP_TESTS=0
MULTI=0
for arg in "$@"; do
  case "$arg" in
    --skip-tests) SKIP_TESTS=1 ;;
    --multi) MULTI=1 ;;
    -h|--help)
      sed -n '2,12p' "$0"
      exit 0
      ;;
  esac
done

VERSION="$(bun -e 'console.log(require("./package.json").version)')"
echo "package.json version <$VERSION>"

# Guard: VERSION export must match package (paths imports package.json)
RUNTIME_V="$(bun -e 'import { VERSION } from "./src/lib/paths.ts"; console.log(VERSION)')"
if [[ "$RUNTIME_V" != "$VERSION" ]]; then
  echo "error: runtime VERSION <$RUNTIME_V> != package.json <$VERSION>" >&2
  exit 1
fi
echo "runtime VERSION matches package.json"

TAG="v${VERSION}"
if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "warn: tag <$TAG> already exists locally"
else
  echo "tag <$TAG> not present locally (create after push of this commit)"
fi

if [[ "$SKIP_TESTS" -eq 0 ]]; then
  echo "→ typecheck"
  bun run typecheck
  echo "→ lint"
  bun run lint
  echo "→ test"
  bun run test
  echo "→ test:cli"
  bun run test:cli
else
  echo "skipping tests (--skip-tests)"
fi

echo "→ clean + build"
bash "$ROOT/scripts/clean.sh"
if [[ "$MULTI" -eq 1 ]]; then
  bash "$ROOT/scripts/build-binary.sh" --multi
else
  bash "$ROOT/scripts/build-binary.sh"
fi

echo
echo "=== next ==="
echo "User ship (push + tag + brew formula commit):"
echo "  ./scripts/ship.sh"
echo "  # then: cd ../homebrew-tap && git push origin main"
echo
echo "Agent must not run ship.sh (pushes remotes). Prep-only is this script."
echo "Manual fallback: scripts/release-checklist.md"
