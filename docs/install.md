# Install

## Prerequisites

1. **Droid CLI** installed and on `PATH` (`droid --version` works).
2. Droid **authenticated** (login and/or `FACTORY_API_KEY`).
3. For from-source / compile: **[Bun](https://bun.sh)** ≥ 1.1.

```sh
droid-companion setup    # first-run wizard (recommended)
droid-companion doctor   # checks only (JSON)
# or: bun src/companion.ts setup
```

**`setup`** (TTY): friendly human walkthrough on stdout — doctor, optional skill install, next commands. No JSON wall.  
Machine/agents: `setup --json` (or non-TTY). Flags: `--yes`, `--skip-skill`, `--target DIR`, `--text`.

**`doctor`** reports PATH, droid version, contract presence, state-dir writability, and **auth presence** (`credentialsPresent` vs `credentialsMissing`). It does **not** live-probe login (`authVerified` stays false).

### Env

| Var | Purpose |
|-----|---------|
| `DROID_BIN` | Path to `droid` if not on PATH |
| `DROID_COMPANION_HOME` | State dir (default `~/.local/share/droid-companion`) |
| `DROID_COMPANION_CONTRACT` | Override path to `contract.md` |
| `FACTORY_API_KEY` | Optional; same as host Droid |

### Contract resolution

1. `DROID_COMPANION_CONTRACT`  
2. Repo `contract/contract.md` (dev)  
3. `$DROID_COMPANION_HOME/contract.md`  
4. `~/.local/share/droid-companion/contract.md`  
5. Share next to binary (`…/share/droid-companion/contract.md`)  
6. **Embedded** contract materialized into the state dir if nothing else exists

## Homebrew

Homebrew 6+ **Tap Trust** blocks third-party taps until you trust them.

```bash
# Once per machine (trust this tap's formulae)
brew tap kumamaki/tap
brew trust --formula kumamaki/tap/droid-companion
# or whole tap: brew trust kumamaki/tap

# Bun must be on PATH at *install* time (formula builds from source).
# Official installer is fine — no need for oven-sh/bun.
which bun || curl -fsSL https://bun.sh/install | bash

brew install droid-companion
droid-companion setup
```

If `brew install` still mentions `oven-sh/bun`, your formula is outdated — pull the latest tap (`brew update`) or reinstall from this repo’s formula (PATH `bun`, no oven-sh dep).

Formula: [kumamaki/homebrew-tap](https://github.com/kumamaki/homebrew-tap) → `Formula/droid-companion.rb`  
Runtime depends on Factory `droid` CLI.

## GitHub Release binary (planned)

1. Download the asset for your OS/arch from the [Releases](https://github.com/kumamaki/droid-companion/releases) page.
2. `chmod +x companion` and put it on `PATH`.
3. `droid-companion doctor`

Build locally:

```bash
./scripts/build-binary.sh
# → dist/droid-companion
```

## From source (works today)

```bash
git clone git@github.com:kumamaki/droid-companion.git
cd droid-companion
bun src/companion.ts --help
bun src/companion.ts setup
```

Optional alias while developing:

```bash
alias companion='bun /path/to/droid-companion/src/companion.ts'
```

## Install the agent skill

Main Droid needs the skill that teaches **when/how** to call this CLI.

```bash
bun src/companion.ts install-skill
# or: ./scripts/install-skill.sh
```

Copies skill + contract into `~/.factory/skills/droid-companion/`.  
Optional: `--target DIR` for a custom skills root.

If that directory already has a private `companion.ts`, install **refuses** unless you pass `--force` (avoids clobbering a hand-maintained skill layout).

## Verify

```sh
droid-companion --version
droid-companion setup --yes          # or: doctor + install-skill
droid-companion spawn --name smoke --persona advisor
droid-companion send smoke "ping"
droid-companion close smoke
```
