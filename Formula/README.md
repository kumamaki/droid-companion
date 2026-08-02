# Homebrew formula

The installable formula for this project lives in the **kumamaki homebrew tap**, not in this repo's CI forever:

- Tap: [kumamaki/homebrew-tap](https://github.com/kumamaki/homebrew-tap)
- Planned formula name: `droid-companion` (binary: `companion`)

## User install

```bash
brew tap kumamaki/tap
brew install droid-companion
companion doctor
```

## When publishing a release

Follow `scripts/release-checklist.md` in this repo:

1. Tag `v0.1.0` and push.
2. Set `sha256` in `homebrew-tap/Formula/droid-companion.rb` from the GitHub source tarball.
3. Push the tap.

This directory is a pointer; the live formula is in the tap.
