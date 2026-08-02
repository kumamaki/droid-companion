#!/usr/bin/env bash
# USER-RUN ship for droid-companion.
#
# One command from a clean, version-bumped main:
#   1. release prep (typecheck · lint · test · build)
#   2. push origin main
#   3. annotated tag v$VERSION + push tag
#   4. download source tarball → sha256
#   5. update homebrew-tap Formula + commit (you still push the tap)
#
# Agent policy: do NOT run this script (it pushes). Agents use ./scripts/release.sh only.
#
# Usage:
#   ./scripts/ship.sh
#   ./scripts/ship.sh --dry-run
#   ./scripts/ship.sh --skip-tests
#   ./scripts/ship.sh --no-brew
#   ./scripts/ship.sh --tap=$HOME/Work/homebrew-tap
#   ./scripts/ship.sh --with-gh-release
#   ./scripts/ship.sh --yes
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DRY_RUN=0
SKIP_TESTS=0
NO_BREW=0
WITH_GH=0
YES=0
MULTI=0
TAP_DIR="${DROID_COMPANION_HOMEBREW_TAP:-$ROOT/../homebrew-tap}"
REPO_SLUG="kumamaki/droid-companion"
FORMULA_NAME="droid-companion"

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --skip-tests) SKIP_TESTS=1 ;;
    --no-brew) NO_BREW=1 ;;
    --with-gh-release) WITH_GH=1 ;;
    --yes|-y) YES=1 ;;
    --multi) MULTI=1 ;;
    --tap=*)
      TAP_DIR="${arg#--tap=}"
      ;;
    -h|--help)
      sed -n '2,20p' "$0"
      exit 0
      ;;
    *)
      echo "error: unknown arg <$arg> (use --tap=DIR)" >&2
      exit 2
      ;;
  esac
done

run() {
  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "dry-run: $*"
  else
    "$@"
  fi
}

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "error: required command not found: <$1>" >&2
    exit 1
  fi
}

need_cmd git
need_cmd bun
need_cmd curl
need_cmd shasum

VERSION="$(bun -e 'console.log(require("./package.json").version)')"
TAG="v${VERSION}"
TARBALL_URL="https://github.com/${REPO_SLUG}/archive/refs/tags/${TAG}.tar.gz"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
HEAD_COMMIT="$(git rev-parse HEAD)"

echo "ship droid-companion <$TAG>"
echo "  branch  <$BRANCH>"
echo "  head    <${HEAD_COMMIT:0:7}>"
echo "  remote  <$(git remote get-url origin 2>/dev/null || echo none)>"
echo "  tap     <$TAP_DIR>"
echo "  dry-run <$DRY_RUN>"

if [[ "$BRANCH" != "main" ]]; then
  echo "error: ship only from main (current <$BRANCH>)" >&2
  exit 1
fi

# Block on dirty tracked product files (.beads noise ignored)
DIRTY="$(git status --porcelain | awk '
  $0 ~ /^\?\?/ { next }
  $0 ~ / \.beads\// { next }
  { print }
')"
if [[ -n "$DIRTY" ]]; then
  echo "error: working tree has tracked changes (commit first):" >&2
  echo "$DIRTY" >&2
  exit 1
fi

TAG_EXISTS=0
TAG_IS_ANCESTOR=0
if git rev-parse "$TAG" >/dev/null 2>&1; then
  # Peel annotated tags to the commit they point at
  TAG_COMMIT="$(git rev-list -n 1 "$TAG")"
  if [[ "$TAG_COMMIT" == "$HEAD_COMMIT" ]]; then
    echo "tag <$TAG> already on HEAD"
    TAG_EXISTS=1
  elif git merge-base --is-ancestor "$TAG_COMMIT" "$HEAD_COMMIT"; then
    # Common when tooling commits land after the version tag (e.g. ship.sh itself).
    # Brew installs the tag tarball — product version is still that commit.
    echo "warn: tag <$TAG> is ancestor <${TAG_COMMIT:0:7}> of HEAD <${HEAD_COMMIT:0:7}>"
    echo "  will push main + existing tag; brew uses the tag commit (not HEAD)"
    TAG_EXISTS=1
    TAG_IS_ANCESTOR=1
  else
    echo "error: tag <$TAG> points at <${TAG_COMMIT:0:7}>, not HEAD and not an ancestor" >&2
    echo "  move/delete the tag only if you intend a re-release" >&2
    exit 1
  fi
fi

if [[ "$YES" -eq 0 && "$DRY_RUN" -eq 0 ]]; then
  printf "Proceed to push main + tag %s and update brew formula? [y/N] " "$TAG"
  read -r ans
  case "$ans" in
    y|Y|yes|YES) ;;
    *) echo "aborted"; exit 1 ;;
  esac
fi

# ── 1. Prep ──────────────────────────────────────────────────────────
PREP_ARGS=()
[[ "$SKIP_TESTS" -eq 1 ]] && PREP_ARGS+=(--skip-tests)
[[ "$MULTI" -eq 1 ]] && PREP_ARGS+=(--multi)
echo "→ release prep"
if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "dry-run: bash scripts/release.sh ${PREP_ARGS[*]:-}"
else
  if [[ ${#PREP_ARGS[@]} -gt 0 ]]; then
    bash "$ROOT/scripts/release.sh" "${PREP_ARGS[@]}"
  else
    bash "$ROOT/scripts/release.sh"
  fi
fi

# ── 2. Push main ─────────────────────────────────────────────────────
echo "→ push origin main"
run git push origin main

# ── 3. Tag + push tag ────────────────────────────────────────────────
if [[ "$TAG_EXISTS" -eq 0 ]]; then
  echo "→ create annotated tag <$TAG>"
  run git tag -a "$TAG" -m "$TAG: droid-companion $VERSION"
elif [[ "$TAG_IS_ANCESTOR" -eq 1 ]]; then
  echo "→ reuse existing ancestor tag <$TAG> (not moving to HEAD)"
else
  echo "→ reuse existing tag <$TAG> on HEAD"
fi
echo "→ push tag <$TAG>"
run git push origin "$TAG"

# ── 4. Tarball sha256 ────────────────────────────────────────────────
echo "→ wait for GitHub source tarball"
SHA=""
TMP_TGZ="$(mktemp -t droid-companion-src.XXXXXX.tar.gz)"
cleanup() { rm -f "$TMP_TGZ"; }
trap cleanup EXIT

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "dry-run: curl $TARBALL_URL → shasum -a 256"
  SHA="dryrun0000000000000000000000000000000000000000000000000000000000"
else
  ok=0
  for attempt in $(seq 1 40); do
    if curl -fsSL "$TARBALL_URL" -o "$TMP_TGZ"; then
      size="$(wc -c <"$TMP_TGZ" | tr -d ' ')"
      if [[ "$size" -gt 1000 ]]; then
        ok=1
        break
      fi
    fi
    echo "  tarball not ready (attempt <$attempt>/40); sleep 3s"
    sleep 3
  done
  if [[ "$ok" -ne 1 ]]; then
    echo "error: could not download <$TARBALL_URL> after retries" >&2
    exit 1
  fi
  SHA="$(shasum -a 256 "$TMP_TGZ" | awk '{print $1}')"
fi
echo "  sha256 <$SHA>"

# ── 5. Homebrew formula ──────────────────────────────────────────────
if [[ "$NO_BREW" -eq 1 ]]; then
  echo "→ skip brew (--no-brew)"
else
  FORMULA="$TAP_DIR/Formula/${FORMULA_NAME}.rb"
  if [[ ! -f "$FORMULA" ]]; then
    echo "error: formula not found at <$FORMULA>" >&2
    echo "  set DROID_COMPANION_HOMEBREW_TAP or --tap=DIR" >&2
    exit 1
  fi
  if [[ -n "$(git -C "$TAP_DIR" status --porcelain -- "Formula/${FORMULA_NAME}.rb" || true)" ]]; then
    echo "warn: formula has local modifications; rewriting version/url/sha256"
  fi

  echo "→ update formula <$FORMULA>"
  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "dry-run: set version=$VERSION url=$TARBALL_URL sha256=$SHA"
  else
    FORMULA_TMP="$(mktemp)"
    awk -v ver="$VERSION" -v url="$TARBALL_URL" -v sha="$SHA" '
      BEGIN { u=0; s=0; v=0 }
      /^  url "/ {
        print "  url \"" url "\""
        u=1
        next
      }
      /^  sha256 "/ {
        print "  sha256 \"" sha "\""
        s=1
        next
      }
      /^  version "/ {
        print "  version \"" ver "\""
        v=1
        next
      }
      { print }
      END {
        if (!u || !s || !v) {
          print "error: formula missing url/sha256/version fields" > "/dev/stderr"
          exit 1
        }
      }
    ' "$FORMULA" >"$FORMULA_TMP"
    mv "$FORMULA_TMP" "$FORMULA"

    if ! grep -q "droid-companion setup" "$FORMULA"; then
      echo "warn: formula caveats do not mention setup — edit manually if needed"
    fi

    echo "→ commit formula in tap"
    git -C "$TAP_DIR" add "Formula/${FORMULA_NAME}.rb"
    if git -C "$TAP_DIR" diff --cached --quiet; then
      echo "  formula already up to date (no commit)"
    else
      git -C "$TAP_DIR" commit -m "chore: Bump ${FORMULA_NAME} to ${VERSION}"
    fi
  fi
fi

# ── 6. Optional GH Release ───────────────────────────────────────────
if [[ "$WITH_GH" -eq 1 ]]; then
  need_cmd gh
  echo "→ gh release create <$TAG>"
  NOTES="droid-companion ${VERSION}

- setup wizard, doctor, install-skill
- background jobs (send --bg / result --wait)
- Homebrew: brew tap kumamaki/tap && brew install droid-companion

See README."
  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "dry-run: gh release create $TAG …"
  else
    if gh release view "$TAG" --repo "$REPO_SLUG" >/dev/null 2>&1; then
      echo "  release already exists"
    else
      shopt -s nullglob
      ASSETS=("$ROOT"/dist/droid-companion*)
      shopt -u nullglob
      if [[ ${#ASSETS[@]} -gt 0 ]]; then
        gh release create "$TAG" --repo "$REPO_SLUG" --title "$TAG" --notes "$NOTES" "${ASSETS[@]}"
      else
        gh release create "$TAG" --repo "$REPO_SLUG" --title "$TAG" --notes "$NOTES"
      fi
    fi
  fi
fi

echo
echo "=== ship complete ==="
echo "  tag     $TAG"
echo "  sha256  $SHA"
if [[ "$NO_BREW" -eq 0 ]]; then
  echo "  tap commit ready — you still push:"
  echo "    cd $TAP_DIR && git push origin main"
  echo "  then: brew update && brew upgrade droid-companion"
fi
echo "  smoke:  droid-companion --version   # expect $VERSION"
echo "          droid-companion setup"
