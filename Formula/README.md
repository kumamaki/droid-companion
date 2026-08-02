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

Follow `scripts/release-checklist.md` / `./scripts/release.sh` in this repo:

1. Bump `package.json` version; tag `vX.Y.Z` and push.
2. Set `sha256` in `homebrew-tap/Formula/droid-companion.rb` from the GitHub source tarball.
3. Push the tap.

This directory is a pointer; the live formula is in the tap.
