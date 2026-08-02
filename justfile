# droid-companion task runner. Run `just` with no args to see all recipes.
#
# Ship is USER-only (pushes main + tag, commits brew formula).
# Agents: use `just release` / `just check` — never `just ship`.

import? 'justfile.local'

# Show the recipe list.
default:
    @just --list

# ── Dev ────────────────────────────────────────────────────────────────────

# Typecheck (tsc --noEmit).
typecheck:
    bun run typecheck

# Lint (oxlint).
lint:
    bun run lint

# Unit tests (bun:test).
test:
    bun run test

# CLI smoke (temp DROID_COMPANION_HOME; no live droid exec).
test-cli:
    bun run test:cli

# typecheck + lint + unit + cli smoke.
check:
    bun run test:all

# Compile host binary → dist/droid-companion.
build:
    bun run build

# Best-effort multi-arch compile.
build-multi:
    bun run build:multi

# Remove dist/ and typecheck temp artifact.
clean:
    bun run clean

# Run CLI from source.
run *args:
    bun src/companion.ts {{ args }}

# Environment doctor (JSON).
doctor:
    bun src/companion.ts doctor

# First-run wizard.
setup *args:
    bun src/companion.ts setup {{ args }}

# ── Release ────────────────────────────────────────────────────────────────

# Prep only: checks + build. Does NOT push or tag. Safe for agents.
release *args:
    bash scripts/release.sh {{ args }}

# USER-ONLY: push main+tag, sha256, commit brew formula (never for agents).
ship *args:
    bash scripts/ship.sh {{ args }}
