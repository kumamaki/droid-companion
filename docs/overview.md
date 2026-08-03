# Overview

## What this is

**droid-companion** is a small CLI on top of `droid exec`. It turns one-shot headless runs into **named, multi-turn partners** the main Droid can keep around.

There is no push channel into the main chat. The main agent (or a human) calls the CLI and relays by **name**.

## Interface rule (locked)

> **JSON for verbs and state. Files for paragraphs.**

| Plane | Form | Examples |
|-------|------|----------|
| **Control** | JSON on stdout; errors JSON on stderr | spawn/send/list/close/status/result, `jobId`, `status`, exit codes |
| **Content** | Files (usually Markdown) | `--message-file ask.md`, `--brief brief.md`, optional `--response-file out.md` |

**Not the API:** a shared `chat.md` (or any single freeform file) as the only bus for status, errors, and concurrency. That races and cannot express job lifecycle cleanly.

Short replies may sit in the JSON `response` field. Long prose should prefer a file path in the envelope (`responseFile` / `--response-file`).

Short **asks** may be a positional `send` argument (≤ 4000 chars). Paragraphs still go through `--message-file`.

## Layers

| Layer | Meaning |
|-------|---------|
| **Companion** | Long-lived named session. Spawn once → many `send`s → `close` when done. |
| **Contract** | `contract/contract.md` injected on spawn (unless `--no-contract`): named specialist relay for the main droid (identity, relay rules, hard stops). Not a full work-style manifesto. |
| **Role** | `--system-prompt` / `--role` specialist flavor **on top** of the contract (how hard to work, tone, domain). |
| **Brief** | Shared brief file (Goal · Constraints · Artifacts · Ask). Path is tracked; content is not inlined into every argv. |
| **Profile** | `full` (default) or `lite` (cheap critique: no heavy skills/MCP/mutators). |
| **Format** | `prose` (default) or `findings` (`severity` · `path:line` · claim). |
| **Jobs** | Background sends (`--bg`) so callers never need infinite foreground waits. |

## Core product vs recipes

**Core (v0.1):** named multi-turn loop — `setup` · `spawn` · `send` · `list` · `close` · `doctor` · `install-skill` · `status` · `result`.

**Recipes (later):** multi-agent one-shots on top of core — `discuss` (two-sided debate), `jury` (parallel multi-model), `vision` (image paths via Read). Not the headline product. Prefer `send --images` over a vision verb.

## Autonomy defaults (when `--auto` omitted)

| Signal | Default |
|--------|---------|
| `--lite` | read-only (no `--auto`) |
| role text mentions implement / fix / patch / refactor / write code / … | `--auto low` |
| otherwise (review / consult) | read-only |

Tracked on the session for later sends: `cwd`, `auto`, `brief`, `format`, `profile`, `role`, `name`.

## Background and notify (summary)

- Companion **never** applies an internal kill timeout to `droid exec`.
- Long work: `send --bg` → job files under the state dir → `status` / `result` / `result --wait`.
- **One in-flight job per name** (second send refused while running).
- Optional `--idempotency-key` for safe retries after host timeouts.
- Optional local `--on-done` hook only. **No chat push** into the main Droid session in v0.1.

Details: [background-jobs.md](background-jobs.md).

## State

Local runtime only (never git):

```
~/.local/share/droid-companion/   # or $DROID_COMPANION_HOME
  sessions.json    # name ↔ sessionId + metadata
  jobs/            # background job metadata + results
```

## Credentials

Same as host Droid: login session and/or `FACTORY_API_KEY`. This CLI does not store API keys.
