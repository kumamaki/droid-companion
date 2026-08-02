# Release checklist (v0.1.0)

Network/GitHub was unreachable from the agent environment when this was written.
Run these on a machine with GitHub access (and valid `gh` / SSH).

## 1. Finish local version

```bash
cd ~/Work/droid-companion
git log --oneline -5
# ensure VERSION is 0.1.0 in src/lib/paths.ts + package.json
```

## 2. Create GitHub repo + push

```bash
# Prefer SSH alias (AGENTS.md): personal:kumamaki/...
gh auth refresh -h github.com   # if gh token broken
gh repo create kumamaki/droid-companion --public --source=. --remote=origin --description "Named multi-turn companion sessions for Factory Droid"
# if remote already set to personal:kumamaki/droid-companion.git:
git push -u origin main
```

If `gh` fails, create empty repo on github.com then:

```bash
git remote add origin personal:kumamaki/droid-companion.git   # if needed
git push -u origin main
```

## 3. Tag and push tag

```bash
git tag -a v0.1.0 -m "v0.1.0: public companion CLI core + background jobs"
git push origin v0.1.0
```

## 4. Optional: attach binary assets

```bash
./scripts/build-binary.sh
# rename for clarity, e.g. droid-companion-darwin-arm64
gh release create v0.1.0 \
  --title "v0.1.0" \
  --notes "Named multi-turn companions for Droid. See README." \
  dist/droid-companion#droid-companion-darwin-arm64
```

## 5. Homebrew formula sha256

```bash
curl -sL https://github.com/kumamaki/droid-companion/archive/refs/tags/v0.1.0.tar.gz | shasum -a 256
# paste into ~/Work/homebrew-tap/Formula/droid-companion.rb sha256
cd ~/Work/homebrew-tap
# fix remote to personal: if needed
git add Formula/droid-companion.rb README.md
git commit -m "feat: Add droid-companion formula"
git push origin main
```

## 6. Install test

```bash
brew tap kumamaki/tap
brew install droid-companion
droid-companion doctor
droid-companion --version
```
