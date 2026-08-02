---
name: droid-companion
description: Spawn and converse with named companion droid sessions for second opinions, multi-turn specialists, or background consults. Use when the user wants a second droid's perspective, to keep a reviewer/fixer around by name, or long companion work that must not block the main session.
---

# Droid Companion

Named, multi-turn partners via the **`companion`** CLI (wraps `droid exec`).

**Core product = companions with names.** Recipes (`discuss` / `jury` / `vision`) are later; do not invent them if the installed CLI lacks them.

```sh
companion <command> …
# from this repo while developing:
bun /path/to/droid-companion/src/companion.ts <command> …
```

## Interface (locked)

> **JSON for verbs and state. Files for paragraphs.**

- **Control:** JSON on stdout (`response`, `roster`, `jobId`, `status`, …). Errors JSON on stderr.
- **Content:** `--message-file`, `--brief`, optional `--response-file` (then Read that path).
- **Not the API:** a shared freeform `chat.md` for lifecycle.

Do not dump raw JSON to the user unless asked; relay by **name**.

## Mental model

| Layer | What |
|-------|------|
| **Companion** | Long-lived named session. Spawn once → many `send`s → `close` when done. |
| **Contract** | Injected on spawn (unless `--no-contract`): named specialist relay (identity, main-droid relationship, hard stops). |
| **Role** | `--system-prompt` / `--role` on top of the contract (domain + how hard to push). |
| **Brief** | Shared brief file path tracked across sends. |
| **Jobs** | `send --bg` → job files → `status` / `result` / `result --wait`. |

There is no push channel into the main chat. You call the CLI and pull results.

## Core commands

### spawn

**Always** pass `--name` (unique, no spaces).

```sh
companion spawn --name audit \
  --system-prompt "You are a senior security auditor. Be concise." \
  --cwd /path/to/project \
  --brief brief.md
```

Presets (preferred for common roles):

```sh
companion spawn --name r1 --preset critic
companion spawn --name sec --preset auditor
companion spawn --name fix --preset fixer --cwd .
companion spawn --name adv --preset advisor
```

Or freeform:

```sh
companion spawn --name critic --lite --format findings \
  --system-prompt "You are a ruthless code reviewer."
```

**Autonomy when `--auto` omitted:** `--lite` → read-only; implement-ish role text → `low`; else read-only.

Output includes `announce`. **You MUST write the name out loud** after spawn, e.g.:

> Companion **audit** is up (security auditor). Call with `send audit "…"`.

Keep a one-line **roster** while live:

`audit · security auditor · cwd ~/proj · last just now`

### send

Accepts **name** (preferred) or sessionId. Prefer `--message-file` for multi-line asks.

```sh
companion send audit --message-file ask.md
companion send audit --message-file - <<'EOF'
1) …
2) …
EOF
```

Batch short follow-ups into **one** send when possible.

`--format findings` → `severity` · `path:line` · claim lines.

Attribute relays: **audit:** …

### Background (long work)

Companion has **no internal kill timeout**. Host shell tools often do.

```sh
companion send audit --bg --message-file deep.md --idempotency-key deep-1
companion result audit --wait
# or: companion status audit && companion result audit
```

Optional:

- `--response-file PATH` — long answer on disk; JSON points at it  
- `--on-done 'cmd'` — **local** hook only (not chat push)  
- `--force` — rare; allow a second send while a job is running  

**Rules:**

1. Anything that might exceed host tool timeout → `--bg`.
2. Use `result --wait` or poll — **never re-send** the same message after a wait abort.
3. Same `--idempotency-key` is a safe retry; bare duplicate send is not.
4. One in-flight job per name (expect error if already running).
5. **Never kill** companion / `droid` PIDs to “unstick”.
6. No expecting push into the main Droid session.
7. Worker is internal `companion _run-job` (same binary); do not invoke it by hand unless debugging.

### list / close

```sh
companion list
companion list --stale
companion list --prune
companion close audit
```

`close` = **untrack** from companion state (not a full guarantee that droid wiped disk session data).

Default health checks are **cheap** (no model pong).

### doctor / install-skill

```sh
companion doctor
companion install-skill
```

`install-skill` copies this skill + contract into `~/.factory/skills/droid-companion/`.  
Run `doctor` when install looks wrong or before first use in a new environment.

## Workflow (default)

1. Unique **name**: `audit`, `rust-reviewer`, `devil`
2. Optional `brief.md`
3. `spawn --name … --system-prompt "…"` (+ `--cwd` / `--brief` / `--lite` / `--format` / `--auto`)
4. **Announce** + roster line
5. `send` (message-file; `--bg` if long)
6. Keep sending — do **not** respawn
7. `close` only when the role is finished

User phrases: “ask audit about X”, “second opinion”, “keep that reviewer around.”

## Main droid rules

1. Named companions only — no UUID-first UX.
2. After spawn: announce + roster in the user transcript.
3. Multi-turn by default; close only when done.
4. Batch questions; `--message-file` for long content.
5. `--lite` + `--format findings` for pure second opinions.
6. Full profile + `--auto low` when the companion must edit.
7. Relay by name; no raw JSON dumps unless asked.
8. Long work → `--bg`; never retry a timed-out send without key/status.
9. JSON control + file content — no chat.md protocol.
10. Transport/runtime abort (non-zero, structured error with `lastResult` partial): **do not re-send** the same ask into that turn — inspect, or `close` + fresh spawn. `lastResult` is progress, not the verdict.

## Notes

- Same credentials as the host (`FACTORY_API_KEY` / droid login).
- Contract ships with the install (`contract/contract.md`); path may be resolved next to the binary or package root.
- Cost scales with turns × models; `--lite` reduces tool surface.
- If a command returns “not implemented”, the installed build is still the docs scaffold — use the private skill path or wait for the core port.
