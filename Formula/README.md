# Homebrew formula

The installable formula for this project lives in the **kumamaki homebrew tap**, not in this repo's CI forever:

- Tap: [kumamaki/homebrew-tap](https://github.com/kumamaki/homebrew-tap)
- Planned formula name: `droid-companion` (binary: `companion`)

## Planned user install

```bash
brew tap kumamaki/tap
brew install droid-companion
companion doctor
```

## When publishing a release

1. Tag a version in this repo and attach compiled binaries on the GitHub Release.
2. Add/update `Formula/droid-companion.rb` in `homebrew-tap` with `url` + `sha256` of the release asset (or source tarball).
3. Document the brew line in this repo's `docs/install.md` and root `README.md`.

This directory is a pointer only so contributors know where packaging lives.
