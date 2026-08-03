# Agent setup guide

You are reading this because a human asked you to **install and set up droid-companion**. Follow this file; do not improvise install paths. After setup, usage is [agent-guide.md](agent-guide.md) and the installed skill.

Canonical repo: https://github.com/kumamaki/droid-companion  
This file (raw): https://raw.githubusercontent.com/kumamaki/droid-companion/main/docs/agent-setup.md

## What droid-companion is

A CLI on top of Factory **`droid exec`**. It gives **named, multi-turn companion sessions** (spawn once → many `send`s → `close`). Control plane is JSON; long content is files. It does **not** replace `droid` and does **not** push into the main chat.

Requires:

1. **`droid` on PATH** (`droid --version`)
2. **Droid auth** already working (login and/or `FACTORY_API_KEY`) — same as the host Droid
3. Optional for from-source builds: **Bun** ≥ 1.1

If `droid` is missing or unauthenticated, fix that first. This tool cannot log the user into Factory for them.

## Goal of this session

Leave the human with:

- `droid-companion` on PATH (or a clear from-source alias)
- `droid-companion doctor` → `ok: true` (or explain remaining fails)
- Skill installed under `~/.factory/skills/droid-companion/` (unless they refuse)
- One verified smoke: spawn → send short ping → close (optional if they only wanted install)

Do **not** open a PR, bump versions, or run `just ship` / `git push` unless they ask.

## Install (pick one)

### A. Homebrew (preferred on macOS)

```bash
brew tap kumamaki/tap
brew trust --formula kumamaki/tap/droid-companion   # Homebrew 6+
# Bun must be on PATH at *install* time (formula builds from source): https://bun.sh
which bun || curl -fsSL https://bun.sh/install | bash
brew install droid-companion
```

### B. From source

```bash
git clone https://github.com/kumamaki/droid-companion.git
cd droid-companion
# needs bun
bun src/companion.ts setup --yes
# optional daily alias:
# alias droid-companion='bun /absolute/path/to/droid-companion/src/companion.ts'
```

### C. Already cloned this repo

```bash
cd /path/to/droid-companion
bun src/companion.ts setup --yes
# or: just setup --yes
```

## Setup steps (always)

Run in order. Prefer non-interactive flags when you are the agent (no TTY prompts).

```bash
droid-companion doctor
# or: bun src/companion.ts doctor

droid-companion setup --yes
# installs skill when safe; doctor + cheat sheet

# if setup skipped skill or path is custom:
droid-companion install-skill
```

Check:

```bash
droid-companion --version
droid-companion doctor          # JSON: ok, authStatus, configPath, stateDir
droid-companion config show     # materializes ~/.config/droid-companion/config.toml if missing
```

Human TTY walkthrough (only if they want interactive text, not JSON):

```bash
droid-companion setup --text
```

## Optional smoke

```bash
droid-companion spawn --name smoke --persona advisor
droid-companion send smoke "reply with one word: pong"
droid-companion close smoke
```

If spawn fails on auth, report `doctor` `authStatus` / signals — do not invent credentials.

## After setup — teach usage briefly

Point the human (and future turns) at:

| Doc | Job |
|-----|-----|
| [agent-guide.md](https://github.com/kumamaki/droid-companion/blob/main/docs/agent-guide.md) | How the main agent should call the CLI |
| [skill/SKILL.md](https://github.com/kumamaki/droid-companion/blob/main/skill/SKILL.md) | Installed skill body |
| [cli-reference.md](https://github.com/kumamaki/droid-companion/blob/main/docs/cli-reference.md) | Flags and JSON shapes |

Minimal loop:

```sh
droid-companion spawn --name audit --persona critic
droid-companion send audit --message-file ask.md
droid-companion list
droid-companion close audit
```

Hard rules to keep:

- Always `--name` on spawn
- JSON for status/jobs; `--message-file` for long content
- Long work: `send --bg` → `result --wait` (no internal kill timeout)
- One in-flight job per name; optional `--idempotency-key`
- No chat push; no recipes (`discuss` / `jury` / `vision`) in v0.1

## Dev flavor (only if they ask)

`droid-companion-dev` / `DROID_COMPANION_FLAVOR=dev` uses isolated config + state:

- `~/.config/droid-companion-dev/config.toml`
- `~/.local/share/droid-companion-dev/`

From this repo: `just run-dev doctor`. Do not switch a normal install to dev unless requested.

## Diagnosis

| Symptom | Check |
|---------|--------|
| command not found | brew link / PATH / alias to `bun …/companion.ts` |
| doctor `droidOnPath: false` | install Factory `droid`, or set `DROID_BIN` |
| `authStatus: credentialsMissing` | `droid` login or `FACTORY_API_KEY` |
| skill install refused | existing private skill layout — need `--force` only if they confirm overwrite |
| bad config | `config show` / fix `~/.config/droid-companion/config.toml` |

More: [install.md](install.md).
