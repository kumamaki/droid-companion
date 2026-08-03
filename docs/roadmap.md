# Roadmap

Audience for v0.1: **agent-first** (JSON control plane, ship skill). Packaging: **Bun compile binary + Homebrew**.

## Locked decisions (do not casually reopen)

- **JSON for verbs/state. Files for paragraphs** (`--message-file` / brief / optional `--response-file`)
- **No internal kill timeout** on `droid exec`
- **Background:** `send --bg` · `status` · `result` · `result --wait`
- **Mutex** one in-flight job per name; optional `--idempotency-key`
- **Notify:** job files + optional local `--on-done` only — **no chat push**
- Names required; thin contract v2; recipes post-v0.1
- Binary name: `droid-companion`

## P0 — first public tag (done)

| Item | Notes |
|------|--------|
| Core commands | `spawn` · `send` · `list` · `close` · `setup` |
| Names required | No anonymous UUID-first spawn |
| Contract · lite · brief · findings | Thin contract v2 + role/presets for style |
| Background jobs | `--bg` · status · result · `--wait` · mutex · idempotency |
| No internal timeouts | Keep forever |
| `doctor` | PATH, contract, state dir; no auth false-green |
| Portable state | `~/.local/share/droid-companion/` |
| Binary + brew | GH + `kumamaki/homebrew-tap` |
| Public skill | Anti-retry + interface rules |
| Interface docs | overview / cli-reference / background-jobs / skill |

## P1 — harden (tooling largely done)

| Item | Notes |
|------|--------|
| Job lifecycle unit tests | classify · mutex · idempotency pure helpers |
| Cheap `list --stale` / `--prune` | Age-based stale + untrack prune; roster jobId/ages; no model pong |
| Contract ship/embed | Install layout without git checkout |
| `install-skill` + `setup` | Distribution friction |
| Atomic state + lock | Concurrent spawn/send safety |
| CI | typecheck · oxlint · bun:test · cli smoke |
| Release script | `scripts/release.sh` + checklist |
| XDG TOML config | defaults + named profiles; `config show`; no auto-prune |

## P2 — recipes (only if demanded)

| Recipe | What |
|--------|------|
| `discuss` | Two-sided debate, N rounds |
| `jury` | Parallel multi-model + optional synthesize |
| `vision` verb | Prefer `send --images` instead |

## P3 — polish

| Item | Notes |
|------|--------|
| Role presets | critic / auditor / fixer / advisor (done) |
| Human text mode | `--text` / TTY roster |
| `fork` | Branch a companion conversation |
| Last response on list | Busy/idle + last answer path |
| npm package | Optional; binary remains primary |
| Multi-arch GH assets | `build-binary.sh --multi` best-effort |

## Explicit non-goals (for now)

- Replacing `droid exec` with an SDK
- Storing API keys inside this CLI
- Pushing remotes or managing Droid login
- Chat push into the main Droid session
- Shared markdown chat-file protocol
- Kitchen-sink multi-agent orchestration (use Droid missions when that fits)

## Current repo phase

**Shippable `0.1.2`:**

- spawn/send/list/close/doctor/setup/install-skill
- send --bg · status · result --wait · mutex · idempotency · on-done
- presets · examples · contract embed + binary share layout
- tooling: `tsc` · oxlint · bun:test · cli smoke · GH Actions · `release.sh`
