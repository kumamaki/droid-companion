# Roadmap

Audience: **agent-first** (JSON control plane, ship skill). Packaging: **Bun compile binary + Homebrew**.

## Locked decisions (do not casually reopen)

- **JSON for verbs/state. Files for paragraphs** (`--message-file` / brief / optional `--response-file`)
- **No internal kill timeout** on `droid exec`
- **Background:** `send --bg` · `status` · `result` · `result --wait`
- **Mutex** one in-flight job per name; optional `--idempotency-key`
- **Notify:** job files + optional local `--on-done` only — **no chat push**
- Names required; thin contract v2; recipes post-v0.1
- Binary name: `droid-companion`
- **Personas** are sealed packages (role + tool_profile + format + auto); `--role` replaces, does not stack
- **Config** is optional XDG TOML; no auto-prune

## Vocabulary (current)

| Term | Meaning |
|------|---------|
| **persona** | Sealed package; CLI `--persona`; config `[personas.NAME]` |
| **tool_profile** | Tool surface `full` \| `lite` (`--tool-profile` / `--lite`) |
| **format** | Reply shape `prose` \| `findings` |
| **role** | Specialist voice; from persona or full CLI replacement |

Legacy aliases still accepted for a transition window: `--preset` / `--profile` → `--persona`; config `[profiles.*]` / `preset=` / bare `profile=full|lite`.

## P0 — first public tag (done)

| Item | Notes |
|------|--------|
| Core commands | `spawn` · `send` · `list` · `close` · `setup` |
| Names required | No anonymous UUID-first spawn |
| Contract · brief · findings | Thin contract v2 + specialist voice |
| Background jobs | `--bg` · status · result · `--wait` · mutex · idempotency |
| No internal timeouts | Keep forever |
| `doctor` | PATH, contract, state dir; no auth false-green |
| Portable state | `~/.local/share/droid-companion/` |
| Binary + brew | GH + `kumamaki/homebrew-tap` |
| Public skill | Anti-retry + interface rules |
| Interface docs | overview / cli-reference / background-jobs / skill |

## P1 — harden (done)

| Item | Notes |
|------|--------|
| Job lifecycle unit tests | classify · mutex · idempotency pure helpers |
| Cheap `list --stale` / `--prune` | Age-based stale + untrack prune; roster jobId/ages/persona; no model pong |
| Contract ship/embed | Install layout without git checkout |
| `install-skill` + `setup` | Distribution friction; human-first TTY setup |
| Atomic state + lock | Concurrent spawn/send safety |
| CI | typecheck · oxlint · bun:test · cli smoke |
| Release script | `scripts/release.sh` + checklist |
| XDG TOML config | `[defaults]` + `[personas.*]`; `config show`; no auto-prune |
| Persona packages | Built-ins critic/auditor/fixer/advisor; `--role` replaces; format kept as reply shape |
| README for GitHub | Why companions exist + personas table |

## P2 — recipes (only if demanded)

| Recipe | What |
|--------|------|
| `discuss` | Two-sided debate, N rounds |
| `jury` | Parallel multi-model + optional synthesize |
| `vision` verb | Prefer `send --images` instead |

## P3 — polish (open)

| Item | Notes |
|------|--------|
| Human text mode | `list --text` / TTY roster for humans |
| `fork` | Branch a companion conversation |
| TTL / house defaults dogfood | Config knobs exist; learn from real use |
| Drop legacy aliases | After one minor with `--persona` only |
| npm package | Optional; binary remains primary |
| Multi-arch GH assets | `build-binary.sh --multi` best-effort |

## Explicit non-goals (for now)

- Replacing `droid exec` with an SDK
- Storing API keys inside this CLI
- Pushing remotes or managing Droid login
- Chat push into the main Droid session
- Shared markdown chat-file protocol
- Kitchen-sink multi-agent orchestration (use Droid missions when that fits)
- adopt/resume for untracked session ids (deferred unless tracking pain returns)

## Current repo phase

**On main (ahead of last public story as `0.1.3` on package.json — bump when shipping):**

- Core: spawn / send / list / close / doctor / setup / install-skill / config show
- Jobs: send --bg · status · result --wait · mutex · idempotency · on-done
- Personas: sealed packages + config `[personas.*]` + legacy aliases
- List hygiene: age-based `--stale` / `--prune`, rich roster
- Tooling: `tsc` · oxlint · bun:test · cli smoke · GH Actions · `release.sh` / `ship.sh`
- Docs: README (why + personas), overview, cli-reference, agent-guide, skill

**Next when ready:** live dogfood → version bump → user `just ship`.
