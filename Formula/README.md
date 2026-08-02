# Homebrew formula

The installable formula for this project lives in the **kumamaki homebrew tap**, not in this repo's CI forever:

- Tap: [kumamaki/homebrew-tap](https://github.com/kumamaki/homebrew-tap)
- Planned formula name: `droid-companion` (binary: `droid-companion`)

## User install

```bash
brew tap kumamaki/tap
brew install droid-companion
droid-companion setup
```

## When publishing a release

Preferred:

```bash
# in droid-companion (version already bumped + committed on main)
./scripts/ship.sh
cd ../homebrew-tap && git push origin main
```

`ship.sh` pushes main+tag, computes tarball sha256, and **commits** the formula.  
You still push the tap. Details: `scripts/release-checklist.md`.

This directory is a pointer; the live formula is in the tap.
