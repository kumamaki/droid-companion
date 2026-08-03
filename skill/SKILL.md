---
name: droid-companion
description: Spawn and converse with named companion droid sessions for second opinions, multi-turn specialists, or background consults. Use when the user wants a second droid's perspective, to keep a reviewer/fixer around by name, or long companion work that must not block the main session.
---

# Droid Companion

Named, multi-turn partners via the **`droid-companion`** CLI (wraps `droid exec`).

**Core product = companions with names.** Recipes (`discuss` / `jury` / `vision`) are later; do not invent them if the installed CLI lacks them.

```sh
droid-companion <command> …
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
| **Contract** | Injected on spawn (unless `--no-contract`). |
| **Persona** | Sealed package: role + tool_profile + format + optional auto. `--persona NAME`. |
| **Role** | From persona, **or** full replacement via `--role` (never stacked). |
| **Tool profile** | `full` \| `lite` (`--tool-profile` / `--lite`). |
| **Format** | Reply shape `prose` \| `findings` (`--format`; default from persona). |
| **Brief** | Shared brief file path tracked across sends. |
| **Jobs** | `send --bg` → job files → `status` / `result` / `result --wait`. |

There is no push channel into the main chat. You call the CLI and pull results.

## Core commands

### spawn

**Always** pass `--name` (unique, no spaces).

```sh
droid-companion spawn --name audit --persona auditor --cwd /path/to/project
droid-companion spawn --name r1 --persona critic
droid-companion spawn --name fix --persona fixer --cwd .
droid-companion spawn --name adv --persona advisor
```

Custom voice (replaces persona role entirely):

```sh
droid-companion spawn --name critic --role "You are a ruthless code reviewer." \
  --tool-profile lite --format findings
```

Built-in personas:

| Name | tool_profile | format | notes |
|------|--------------|--------|-------|
| critic | lite | findings | code review |
| auditor | lite | findings | security |
| fixer | full | prose | auto=low |
| advisor | full | prose | tradeoffs |

Config: `~/.config/droid-companion/config.toml` (created on first load if missing) → `[personas.NAME]`  
`droid-companion config show` · `spawn --persona review`

Compat: `--preset` / `--profile` = `--persona`.

**Autonomy when `--auto` omitted:** lite → read-only; implement-ish role text → `low`; else read-only.

Output includes `announce`. **You MUST write the name out loud** after spawn. Keep a one-line **roster** while live.

### send

Accepts **name** (preferred) or sessionId.

- **Short ping:** positional message (max 4000 chars, config-overridable)  
- **Paragraphs / multi-line:** `--message-file PATH` or `--message-file -`  
- Huge positional argv is **rejected**.

```sh
droid-companion send audit "quick: does this API look wrong?"
droid-companion send audit --message-file ask.md
```

Batch short follow-ups into **one** send when possible.  
`--format findings` → `severity` · `path:line` · claim lines.  
Attribute relays: **audit:** …

### Background (long work)

Companion has **no internal kill timeout**. Host shell tools often do.

```sh
droid-companion send audit --bg --message-file deep.md --idempotency-key deep-1
droid-companion result audit --wait
```

**Rules:** long work → `--bg`; never re-send after wait abort; one job per name; never kill droid PIDs; no chat push.

### list / close

```sh
droid-companion list
droid-companion list --stale --older-than 24h
droid-companion list --prune
droid-companion close audit
```

Roster includes `persona` · `toolProfile` · `format` · `job` / `jobId` · ages.  
Stale = idle longer than threshold with no running job. Prune untracks only.

### setup / doctor / install-skill / config

```sh
droid-companion setup              # humans: TTY wizard
droid-companion setup --yes --json # scripts
droid-companion doctor
droid-companion config show
droid-companion install-skill
```

## Workflow (default)

1. Unique **name**
2. Optional `brief.md`
3. `spawn --name … --persona …` (+ `--cwd` / `--brief` / overrides)
4. **Announce** + roster line
5. `send` (message-file; `--bg` if long)
6. Keep sending — do **not** respawn
7. `close` only when finished

## Main droid rules

1. Named companions only.
2. After spawn: announce + roster.
3. Multi-turn by default; close only when done.
4. Short positional pings ok; `--message-file` for long content.
5. `--persona critic` / lite + findings for pure second opinions.
6. `--persona fixer` (or full tool profile + `--auto low`) when editing.
7. Relay by name; no raw JSON dumps unless asked.
8. Long work → `--bg`; never retry a timed-out send without key/status.
9. JSON control + file content — no chat.md protocol.
10. `--role` replaces persona voice; do not invent personas not in config/built-ins.

## Notes

- Same credentials as the host (`FACTORY_API_KEY` / droid login).
- Cost scales with turns × models; lite tool profile reduces tool surface.
