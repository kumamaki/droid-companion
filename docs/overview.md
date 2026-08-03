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
| **Contract** | `contract/contract.md` injected on spawn (unless `--no-contract`): named specialist relay (identity, hard stops). |
| **Persona** | Sealed package: **role** + **tool_profile** + **format** + optional **auto**. Built-ins: `critic` · `auditor` · `fixer` · `advisor`. Config: `[personas.NAME]`. CLI: `--persona`. |
| **Role** | Specialist voice. From the persona, **or** full replacement via `--role` / `--system-prompt` (never stacked on top of persona role). |
| **Tool profile** | `full` \| `lite` — tool surface (`--tool-profile` / `--lite`). Not the same as `--persona`. |
| **Format** | Reply shape: `prose` \| `findings` (`--format`). Default comes from the persona; CLI may override. |
| **Brief** | Shared brief file path tracked across sends. |
| **Jobs** | Background sends (`--bg`) so callers never need infinite foreground waits. |

## Core product vs recipes

**Core:** named multi-turn loop — `setup` · `spawn` · `send` · `list` · `close` · `doctor` · `install-skill` · `config` · `status` · `result`.

**Recipes (later):** multi-agent one-shots — `discuss` / `jury` / `vision`. Prefer `send --images` over a vision verb.

## Config

```
~/.config/droid-companion/config.toml          # prod binary
~/.config/droid-companion-dev/config.toml      # droid-companion-dev
```

Override path: `DROID_COMPANION_CONFIG`.  
**First load creates the file** with starter defaults if it is missing (never overwrites an existing file).

Sticky **`[defaults]`** + user **`[personas.NAME]`**.  
Precedence: **CLI > persona package > `[defaults]` > built-ins**.

**Dev flavor:** `droid-companion-dev` (or `DROID_COMPANION_FLAVOR=dev`) uses isolated config + state so dogfood never clobbers prod. See [install.md](install.md#dev-flavor).

See [examples/config.toml](../examples/config.toml) and [cli-reference](cli-reference.md#config).

## Autonomy defaults (when `--auto` omitted)

| Signal | Default |
|--------|---------|
| lite tool profile | read-only (no `--auto`) |
| persona / role text mentions implement / fix / patch / … | `--auto low` |
| otherwise (review / consult) | read-only |

Tracked on the session: `cwd`, `auto`, `brief`, `format`, `toolProfile`, `persona`, `role`, `name`.

## Background and notify (summary)

- Companion **never** applies an internal kill timeout to `droid exec`.
- Long work: `send --bg` → job files → `status` / `result` / `result --wait`.
- **One in-flight job per name**.
- Optional `--idempotency-key` · optional local `--on-done` only. **No chat push**.

Details: [background-jobs.md](background-jobs.md).

## State

Local runtime only (never git):

```
~/.local/share/droid-companion/       # prod (or $DROID_COMPANION_HOME)
~/.local/share/droid-companion-dev/   # droid-companion-dev
  sessions.json
  jobs/
```

## Credentials

Same as host Droid: login session and/or `FACTORY_API_KEY`. This CLI does not store API keys.
