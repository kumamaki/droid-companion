# droid-companion

Named, multi-turn **companion** sessions for [Factory Droid](https://factory.ai).

The main Droid (or you) keeps specialists on speed dial: spawn once by **name**, send many turns, close when done. **Agent-first:** JSON for control, files for long content.

```sh
companion spawn --name audit --lite --format findings \
  --system-prompt "You are a ruthless code reviewer."
companion send audit --message-file ask.md
companion list
companion close audit
```

> **Status:** `0.1.0-dev` — core + background jobs (`send --bg` · `status` · `result --wait` · mutex · idempotency).

## Interface (locked)

| Plane | Form |
|-------|------|
| **Control** | JSON on stdout (verbs, job status, errors) |
| **Content** | Files — `--message-file`, `--brief`, optional `--response-file` |

**JSON for verbs/state. Files for paragraphs.**  
Not the API: a shared freeform `chat.md` as the only bus.

## Prerequisites

| Need | Why |
|------|-----|
| **[Droid CLI](https://docs.factory.ai)** on `PATH` | Companions are `droid exec` sessions |
| Droid login / credentials | Same auth as your host Droid |
| **Bun** (from source) | Dev and compile |

## Install

See **[docs/install.md](docs/install.md)**. Short version:

```bash
# Planned
brew tap kumamaki/tap
brew install droid-companion

# From source (today)
git clone git@github.com:kumamaki/droid-companion.git
cd droid-companion
bun src/companion.ts doctor
```

Binary name: **`companion`**. Package / repo: **`droid-companion`**.

## Agent loop (v0.1)

1. `companion spawn --name <unique> …` — always name companions  
2. **Announce** the name in the user transcript; keep a one-line roster  
3. `companion send <name> …` — prefer `--message-file` for long asks  
4. Long work → **`send --bg`**, then `result --wait` or `status` / `result` (do **not** re-send after a timeout)  
5. `companion close <name>` when finished (**untrack**; droid may still keep session data)  

Hard rules:

- Companion **never** applies an internal kill timeout to `droid exec`  
- One in-flight job per name; optional `--idempotency-key` for safe retries  
- Notify = job files + optional local `--on-done` — **no chat push** into main Droid  
- Never kill companion / `droid` PIDs to “unstick”  

Full playbook: **[docs/agent-guide.md](docs/agent-guide.md)** · skill: **[skill/SKILL.md](skill/SKILL.md)** · jobs: **[docs/background-jobs.md](docs/background-jobs.md)**

## Docs

| Doc | Contents |
|-----|----------|
| [overview](docs/overview.md) | Mental model + interface rule |
| [install](docs/install.md) | Brew, binary, from source |
| [agent-guide](docs/agent-guide.md) | Main-droid workflow + anti-timeout policy |
| [cli-reference](docs/cli-reference.md) | Commands, flags, JSON shapes |
| [background-jobs](docs/background-jobs.md) | `--bg` / status / result / wait / notify |
| [roadmap](docs/roadmap.md) | P0 vs later |

## License

[MIT](LICENSE) · © 2026 kumamaki
