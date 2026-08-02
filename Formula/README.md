# Homebrew formula

The installable formula for this project lives in the **kumamaki homebrew tap**, not in this repo's CI forever:

- Tap: [kumamaki/homebrew-tap](https://github.com/kumamaki/homebrew-tap)
- Planned formula name: `droid-companion` (binary: `droid-companion`)

## User install

```bash
brew tap kumamaki/tap
brew trust --formula kumamaki/tap/droid-companion   # Homebrew 6+ Tap Trust
# Bun on PATH required at install time (not oven-sh/bun)
brew install droid-companion
droid-companion setup
```

## When publishing a release

Preferred:

```bash
# in droid-companion (version already bumped + committed on main)
just ship
# or: ./scripts/ship.sh
```

`ship` / `ship.sh` pushes main+tag, computes tarball sha256, **commits and pushes** the formula in `homebrew-tap`.  
Details: `scripts/release-checklist.md`.

This directory is a pointer; the live formula is in the tap.
