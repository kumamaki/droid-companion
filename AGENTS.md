# AGENTS.md — droid-companion

Public CLI that gives Factory Droid **named multi-turn companion sessions**.

## Layout

| Path | Role |
|------|------|
| `src/companion.ts` | CLI entry (`droid-companion`) |
| `contract/contract.md` | Injected companion behavior (unless `--no-contract`) |
| `skill/SKILL.md` | Skill for the **main** Droid (how to call this CLI) |
| `docs/` | Human + agent docs |
| `scripts/build-binary.sh` | `bun build --compile` |

## Runtime dependency

Requires the **`droid` CLI** on `PATH` (Factory). Companions are `droid exec` sessions with naming, contract, and job tracking layered on top.

## Interface (locked — do not casually reopen)

1. **JSON for verbs/state. Files for paragraphs.**  
   Control plane = JSON stdout / error JSON stderr.  
   Content plane = `--message-file`, `--brief`, optional `--response-file`.  
   Do not use a shared freeform markdown chat file as the API.
2. **No internal kill timeout** on companion / `droid exec`.
3. Long work = `send --bg` + `status` / `result` / `result --wait`.
4. **One in-flight job per name** (mutex). Optional `--idempotency-key`.
5. Notify = job files + optional local `--on-done` only. **No chat push** into main Droid in v0.1.
6. `--name` required on spawn. No anonymous UUID-first UX.
7. Recipes (`discuss` / `jury` / `vision`) are post-v0.1.
8. Binary name: `droid-companion`. Package/repo: `droid-companion`.

## State (local, not in git)

Default: `~/.local/share/droid-companion/` (or `DROID_COMPANION_HOME`)  
Dev binary `droid-companion-dev` / `DROID_COMPANION_FLAVOR=dev`: `~/.local/share/droid-companion-dev/` + `~/.config/droid-companion-dev/config.toml`.

- sessions registry  
- background job metadata / result files  

Never commit session or job state. Prefer atomic writes + lock when implementing.

## Working in this repo

1. Read `docs/overview.md` + `docs/roadmap.md` + `docs/background-jobs.md` before changing product surface.
2. Track durable work with `bd` only (see below).
3. Contract is a **thin** specialist relay (`contractVersion: 2`) — not a full autonomy manifesto; **personas** (role + tool_profile + format + auto) carry work style.

## Dev commands

Prefer **`just`** (`justfile`). `bun run …` still works.

```sh
just                 # list recipes
just check           # typecheck · lint · unit · cli smoke
just run -- --help
just run-dev doctor  # isolated config + state (droid-companion-dev)
just doctor
just setup --yes --skip-skill
just build           # dist/droid-companion + dist/droid-companion-dev
just release         # prep only; does not push
# NEVER: just ship   — user-only (pushes main+tag + homebrew-tap)
```

## Ship notes

- Homebrew formula lives in `kumamaki/homebrew-tap` (see `Formula/README.md`).
- **User** ships with `just ship` / `./scripts/ship.sh` (see `scripts/release-checklist.md`) — includes formula **commit + push**.
- **Agent** uses `just release` / `./scripts/release.sh` only — never `ship`, never push/tag.
- Do not push remotes from the agent unless the user asks; never force-push.

## Issue tracking

- `bd` is the sole tracker for durable work. Create before implementation,
  claim when starting, close only after verification. Run `bd prime` for the
  command reference.
- Beads is **local-only and Dolt-native** here — all of `.beads/` is
  git-ignored and never committed (this is a public repo).
