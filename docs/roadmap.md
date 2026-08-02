# Roadmap

Audience for v0.1: **agent-first** (JSON control plane, ship skill). Packaging: **Bun compile binary + Homebrew**.

## Locked decisions (do not casually reopen)

- **JSON for verbs/state. Files for paragraphs** (`--message-file` / brief / optional `--response-file`)
- **No internal kill timeout** on `droid exec`
- **Background:** `send --bg` · `status` · `result` · `result --wait`
- **Mutex** one in-flight job per name; optional `--idempotency-key`
- **Notify:** job files + optional local `--on-done` only — **no chat push**
- Names required; thin contract v2; recipes post-v0.1

## P0 — first public tag

| Item | Notes |
|------|--------|
| Core commands | `spawn` · `send` · `list` · `close` |
| Names required | No anonymous UUID-first spawn |
| Contract · lite · brief · findings | Thin contract v2 + role/presets for style |
| Background jobs | `--bg` · status · result · `--wait` · mutex · idempotency |
| No internal timeouts | Keep forever |
| `doctor` | PATH, contract, state dir; no auth false-green |
| Portable state | `~/.local/share/droid-companion/` |
| Binary + brew | GH Release + `kumamaki/homebrew-tap` |
| Public skill | Anti-retry + interface rules |
| Interface docs | overview / cli-reference / background-jobs / skill |

## P1 — harden

| Item | Notes |
|------|--------|
| Job lifecycle tests | running → done; no double-send |
| Cheap `list --stale` / `--prune` | No model pong by default |
| Contract ship/embed | Install layout without git checkout |
| `install-skill` + examples | Distribution friction |
| Atomic state + lock | Concurrent spawn/send safety |
| CI | typecheck + doctor smoke |

## P2 — recipes (only if demanded)

| Recipe | What |
|--------|------|
| `discuss` | Two-sided debate, N rounds |
| `jury` | Parallel multi-model + optional synthesize |
| `vision` verb | Prefer `send --images` instead |

## P3 — polish

| Item | Notes |
|------|--------|
| Role presets | critic / auditor / fixer / advisor |
| Human text mode | `--text` / TTY roster |
| `fork` | Branch a companion conversation |
| Last response on list | Busy/idle + last answer path |
| npm package | Optional; binary remains primary |

## Explicit non-goals (for now)

- Replacing `droid exec` with an SDK
- Storing API keys inside this CLI
- Pushing remotes or managing Droid login
- Chat push into the main Droid session
- Shared markdown chat-file protocol
- Kitchen-sink multi-agent orchestration (use Droid missions when that fits)

## Current repo phase

**Docs bake-in of locked decisions** (`0.1.0-dev`):

- Layout, docs, contract v2, skill, build script stub
- CLI: `--help` · `--version` · `doctor`
- Full port of private `companion.ts` + jobs = next implementation slice
