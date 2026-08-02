# Install

## Prerequisites

1. **Droid CLI** installed and on `PATH` (`droid --version` works).
2. Droid **authenticated** (same login you use interactively).
3. For from-source / compile: **[Bun](https://bun.sh)** ≥ 1.1.

```sh
companion doctor   # or: bun src/companion.ts doctor
```

`doctor` reports PATH, droid version, contract presence, and state-dir writability.

## Homebrew (planned)

```bash
brew tap kumamaki/tap
brew install droid-companion
companion doctor
```

Formula ships in [kumamaki/homebrew-tap](https://github.com/kumamaki/homebrew-tap), not as the long-term source of truth inside this repo. See `Formula/README.md`.

## GitHub Release binary (planned)

1. Download the asset for your OS/arch from the [Releases](https://github.com/kumamaki/droid-companion/releases) page.
2. `chmod +x companion` and put it on `PATH`.
3. `companion doctor`

Build locally:

```bash
./scripts/build-binary.sh
# → dist/companion
```

## From source (works today)

```bash
git clone git@github.com:kumamaki/droid-companion.git
cd droid-companion
bun src/companion.ts --help
bun src/companion.ts doctor
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

## Verify

```sh
companion --version
companion doctor
# after core port:
# companion spawn --name smoke --lite --system-prompt "You reply with pong only."
# companion send smoke "ping"
# companion close smoke
```
