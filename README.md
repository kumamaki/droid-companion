# droid-companion

Named multi-turn companion sessions for [Factory Droid](https://factory.ai).

You (or the main Droid) spawn a specialist once by **name**, talk to it across many turns, and close it when the job is done. The companion keeps its own session context. You call it by name; nothing is pushed into your main chat.

```sh
droid-companion spawn --name audit --persona critic
droid-companion send audit --message-file ask.md
droid-companion list
droid-companion close audit
```

**Status:** `0.1.3` — core loop, background jobs, personas, optional config, `setup` wizard.

## Why use this

`droid exec` is one-shot. If you want a second opinion, a security pass, or a fixer that remembers the last three turns, you either re-explain everything each call or invent your own session bookkeeping.

droid-companion does that bookkeeping:

- **Names** — `audit`, `rust-reviewer`, `fixer`. No anonymous UUID-first UX.
- **Multi-turn** — spawn once, `send` many times, same session.
- **Personas** — sealed packages for common specialist shapes (see below).
- **Agent-safe I/O** — JSON for status and jobs; files for long prompts and answers.
- **Long work** — `send --bg` + `result --wait` so host shell timeouts do not re-fire the same turn.
- **No kill timer** on the companion itself. One in-flight job per name. Optional idempotency keys.

For a single throwaway call, stick with `droid exec`. Reach for companions when the specialist should remember prior turns.

## Personas

A **persona** is a sealed package: role text + tool profile + reply shape + optional autonomy. You pick it with `--persona`. You do not stack a second system prompt on top of it.

| Persona | Tool profile | Format | Auto | Use when |
|---------|--------------|--------|------|----------|
| `critic` | lite | findings | — | Ruthless code review |
| `auditor` | lite | findings | — | Auth, injection, secrets, privilege boundaries |
| `fixer` | full | prose | `low` | Small focused implementations |
| `advisor` | full | prose | — | Tradeoffs and recommendations |

**Tool profile** is what the companion can do:

- `lite` — analysis only; heavy tools (skills, nested agents) disabled; read-only by default
- `full` — normal tool surface; can edit when autonomy allows

**Format** is reply shape:

- `prose` — normal writing
- `findings` — flat lines: `severity` · `path:line` · claim

Defaults come from the persona. Override with `--tool-profile`, `--lite`, or `--format` when you need a one-off change.

**Custom voice** replaces the persona role entirely (no stacking):

```sh
droid-companion spawn --name api --role "You review public API design only." \
  --tool-profile lite --format findings
```

First load creates `~/.config/droid-companion/config.toml` if it is missing (starter defaults only). Edit it to add packages:

```toml
# ~/.config/droid-companion/config.toml
[personas.review]
role = "You are a ruthless API reviewer."
tool_profile = "lite"
format = "findings"

[personas.fix]
extends = "fixer"
# cwd = "."
```

```sh
droid-companion config show
droid-companion spawn --name r1 --persona review
```

## Interface

| Plane | Form |
|-------|------|
| **Control** | JSON on stdout (spawn/send/list/status/result, job ids, errors) |
| **Content** | Files — `--message-file`, `--brief`, optional `--response-file` |

Short pings may be a positional argument (`send audit "looks ok?"`). Long asks go in a file. Do not use a shared freeform `chat.md` as the control bus.

## Install

Needs the **[Droid CLI](https://docs.factory.ai)** on `PATH` and the same login / `FACTORY_API_KEY` as your host Droid.

```bash
# Homebrew (Homebrew 6+ needs tap trust)
brew tap kumamaki/tap
brew trust --formula kumamaki/tap/droid-companion
# Bun on PATH at install time (https://bun.sh)
brew install droid-companion
droid-companion setup
```

From source:

```bash
git clone https://github.com/kumamaki/droid-companion.git
cd droid-companion
bun src/companion.ts setup
```

Non-interactive:

```bash
droid-companion setup --yes
# skill only:
droid-companion install-skill
```

Full install notes: [docs/install.md](docs/install.md).

## Quick loop

```sh
droid-companion spawn --name audit --persona auditor --cwd .
droid-companion send audit --message-file examples/ask.md

# long work (do not foreground past host tool timeouts)
droid-companion send audit --bg --message-file deep.md --idempotency-key deep-1
droid-companion result audit --wait

droid-companion list
droid-companion close audit
```

Rules:

1. Always `--name` on spawn.
2. Prefer `--message-file` for multi-line content.
3. If the turn might exceed the host shell timeout, use `send --bg`, then `status` / `result` / `result --wait`.
4. After a wait abort, do not re-send the same ask. Poll, or reuse `--idempotency-key`.
5. One in-flight job per name. Do not kill companion / `droid` PIDs to unstick a session.
6. `close` untracks local state; Droid may still keep session data on disk.

## Docs

| Doc | Contents |
|-----|----------|
| [overview](docs/overview.md) | Layers, config, autonomy defaults |
| [install](docs/install.md) | Brew, binary, from source |
| [agent-guide](docs/agent-guide.md) | How the main Droid should call this CLI |
| [cli-reference](docs/cli-reference.md) | Commands, flags, JSON shapes |
| [background-jobs](docs/background-jobs.md) | `--bg`, mutex, idempotency, notify |
| [roadmap](docs/roadmap.md) | Shipped vs later |
| [skill/SKILL.md](skill/SKILL.md) | Skill installed into `~/.factory/skills` |
| [examples/](examples/) | `ask.md`, `brief.md`, `config.toml` |

## License

[MIT](LICENSE) · © 2026 kumamaki
