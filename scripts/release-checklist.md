# Release checklist

## Roles

| Who | Tool | Pushes? |
|-----|------|---------|
| **You** | `just ship` / `./scripts/ship.sh` | Yes — `main` + tag + formula commit **and** tap push |
| **Agent** | `just release` / `./scripts/release.sh` only | **Never** |

## Happy path (preferred)

1. Bump **`package.json` `version`** (single source; `src/lib/paths.ts` imports it).
2. Commit on `main` (version + product changes).
3. From a clean tree:

```bash
cd ~/Work/droid-companion
just ship
# optional:
# just ship --yes
# just ship --with-gh-release
# just ship --tap=$HOME/Work/homebrew-tap
# just ship --dry-run
# ./scripts/ship.sh   # same as just ship
```

`ship.sh` / `just ship` will:

1. Run release prep (typecheck · lint · unit · cli smoke · build)
2. `git push origin main`
3. Annotated tag `v$VERSION` + push tag
4. Download GitHub source tarball → sha256
5. Rewrite `homebrew-tap/Formula/droid-companion.rb` (url / sha256 / version), **commit**, and **push** the tap

Then:

```bash
brew update && brew upgrade droid-companion
droid-companion --version
droid-companion setup
```

Flags: `--no-brew` (skip formula) · `--no-brew-push` (commit only) ·  
Env: `DROID_COMPANION_HOMEBREW_TAP=/path/to/homebrew-tap`.

## Prep only (agents / no network push)

```bash
./scripts/release.sh
./scripts/release.sh --skip-tests
./scripts/release.sh --multi
```

## Manual fallback

If you cannot run `ship.sh`:

```bash
git push origin main
git tag -a vX.Y.Z -m "vX.Y.Z"
git push origin vX.Y.Z
curl -sL https://github.com/kumamaki/droid-companion/archive/refs/tags/vX.Y.Z.tar.gz | shasum -a 256
# edit formula url/sha256/version → commit + push tap
```

## Notes

- Tags are still required: Homebrew installs from the **tag tarball**, not floating `main`.
- Automation removes the copy-paste; it does not remove versioned releases.
- Never force-push tags. Never run `ship.sh` from the agent.
