# Release checklist

Agent does **not** push remotes. You run push / tag / brew / gh release.

Automated prep:

```bash
cd ~/Work/droid-companion
./scripts/release.sh          # typecheck · lint · test · cli smoke · build
# ./scripts/release.sh --multi
```

## 1. Version

Single source: **`package.json` `version`** (imported by `src/lib/paths.ts`).

```bash
# bump only package.json, e.g. 0.1.2
bun -e 'import { VERSION } from "./src/lib/paths.ts"; console.log(VERSION)'
# must match package.json
```

## 2. Push main + tag

```bash
git push origin main
git tag -a v0.1.2 -m "v0.1.2: …"
git push origin v0.1.2
```

(Use the version you actually bumped.)

## 3. Optional: GH Release assets

```bash
./scripts/build-binary.sh --multi
gh release create v0.1.2 \
  --title "v0.1.2" \
  --notes "See README." \
  dist/droid-companion*
```

Host-only binary is enough if brew builds from source.

## 4. Homebrew formula sha256

```bash
curl -sL https://github.com/kumamaki/droid-companion/archive/refs/tags/v0.1.2.tar.gz | shasum -a 256
# paste into ~/Work/homebrew-tap/Formula/droid-companion.rb (version, url, sha256)
cd ~/Work/homebrew-tap
git add Formula/droid-companion.rb
git commit -m "chore: Bump droid-companion to 0.1.2"
git push origin main
```

## 5. Install smoke

```bash
brew update
brew upgrade droid-companion   # or: brew reinstall droid-companion
droid-companion setup --yes
droid-companion --version
droid-companion doctor
```
