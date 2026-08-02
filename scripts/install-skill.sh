#!/usr/bin/env bash
# Install public skill into ~/.factory/skills/droid-companion
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bun "$ROOT/src/companion.ts" install-skill "$@"
