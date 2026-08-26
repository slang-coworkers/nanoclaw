#!/bin/bash
set -euo pipefail

# setup.sh — Bootstrap script for NanoClaw
# Handles Node.js/pnpm setup, then hands off to the Node.js setup modules.
# This is the only bash script in the setup flow.

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Where verbose bootstrap logs go. nanoclaw.sh captures setup.sh's stdout to
# the per-step raw log, but legacy code in this script + install-node.sh
# also calls `log` which writes to a file. Route those to the raw log so
# they don't contaminate the progression log (logs/setup.log).
# Default: write to the raw bootstrap log if nanoclaw.sh pointed us there,
# else fall back to a dedicated bootstrap log (keeps standalone `bash
# setup.sh` invocations working).
LOG_FILE="${NANOCLAW_BOOTSTRAP_LOG:-${PROJECT_ROOT}/logs/bootstrap.log}"

mkdir -p "$(dirname "$LOG_FILE")"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [bootstrap] $*" >> "$LOG_FILE"; }

# --- Platform detection ---

detect_platform() {
  local uname_s
  uname_s=$(uname -s)
  case "$uname_s" in
    Darwin*) PLATFORM="macos" ;;
    Linux*)  PLATFORM="linux" ;;
    *)       PLATFORM="unknown" ;;
  esac

  IS_WSL="false"
  if [ "$PLATFORM" = "linux" ] && [ -f /proc/version ]; then
    if grep -qi 'microsoft\|wsl' /proc/version 2>/dev/null; then
      IS_WSL="true"
    fi
  fi

  IS_ROOT="false"
  if [ "$(id -u)" -eq 0 ]; then
    IS_ROOT="true"
  fi

  log "Platform: $PLATFORM, WSL: $IS_WSL, Root: $IS_ROOT"
}

# --- Node.js check ---

check_node() {
  NODE_OK="false"
  NODE_VERSION="not_found"
  NODE_PATH_FOUND=""

  if command -v node >/dev/null 2>&1; then
    NODE_VERSION=$(node --version 2>/dev/null | sed 's/^v//')
    NODE_PATH_FOUND=$(command -v node)
    local major
    major=$(echo "$NODE_VERSION" | cut -d. -f1)
    if [ "$major" -ge 22 ] 2>/dev/null; then
      NODE_OK="true"
    fi
    log "Node $NODE_VERSION at $NODE_PATH_FOUND (major=$major, ok=$NODE_OK)"
  else
    log "Node not found"
  fi
}

# --- pnpm install ---

install_deps() {
  DEPS_OK="false"
  NATIVE_OK="false"

  if [ "$NODE_OK" = "false" ]; then
    log "Skipping pnpm install — Node not available"
    return
  fi

  cd "$PROJECT_ROOT"

  # Corepack's first-use "Do you want to continue? [Y/n]" prompt would hang
  # the script since we redirect stdout/stderr to the log file — the prompt
  # is invisible but corepack still blocks on stdin. Auto-accept.
  export COREPACK_ENABLE_DOWNLOAD_PROMPT=0

  # Preferred path: enable corepack so `pnpm` shim lands on PATH.
  if command -v corepack >/dev/null 2>&1; then
    log "Enabling corepack"
    corepack enable >> "$LOG_FILE" 2>&1 || true

    # On Linux/WSL with system-wide Node (e.g. apt-installed to /usr/bin),
    # corepack needs root to symlink /usr/bin/pnpm. macOS Homebrew installs
    # land in a user-writable prefix, and a sudo retry there would create
    # root-owned shims inside /opt/homebrew that later break brew — so the
    # retry is Linux-only.
    if ! command -v pnpm >/dev/null 2>&1 && [ "$PLATFORM" = "linux" ] \
        && command -v sudo >/dev/null 2>&1; then
      log "pnpm not on PATH after corepack enable — retrying with sudo"
      sudo corepack enable >> "$LOG_FILE" 2>&1 || true
    fi
  else
    log "corepack not available — will fall back to npm-install pnpm"
  fi

  # Fallback: some Node installs (older nvm, node@22 keg-only, minimal
  # distro packages) don't include corepack. Install pnpm directly at the
  # version pinned via package.json's `packageManager` field.
  if ! command -v pnpm >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
    local pinned
    pinned=$(grep -E '"packageManager"' "$PROJECT_ROOT/package.json" 2>/dev/null \
      | head -1 \
      | sed -E 's/.*"pnpm@([^"]+)".*/\1/')
    [ -z "$pinned" ] && pinned="latest"
    log "Installing pnpm@${pinned} via npm"
    npm install -g "pnpm@${pinned}" >> "$LOG_FILE" 2>&1 \
      || ([ "$PLATFORM" = "linux" ] && command -v sudo >/dev/null 2>&1 \
            && sudo npm install -g "pnpm@${pinned}" >> "$LOG_FILE" 2>&1) \
      || true
  fi

  # `npm install -g` writes to npm's global prefix, which isn't always on the
  # shell PATH — common on macOS where the user has `npm config set prefix
  # ~/.npm-global` to avoid sudo, or on Linux where /usr/local/bin isn't in
  # PATH. Discover the prefix and prepend its bin dir so `command -v pnpm`
  # sees the new install.
  if ! command -v pnpm >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
    local npm_prefix
    npm_prefix=$(npm config get prefix 2>/dev/null)
    if [ -n "$npm_prefix" ] && [ -x "$npm_prefix/bin/pnpm" ]; then
      export PATH="$npm_prefix/bin:$PATH"
      log "Prepended npm prefix bin to PATH: $npm_prefix/bin"
    fi
  fi

  if ! command -v pnpm >/dev/null 2>&1; then
    log "pnpm not on PATH after corepack + npm fallback"
    return
  fi

  log "Running pnpm install --frozen-lockfile"
  if pnpm install --frozen-lockfile >> "$LOG_FILE" 2>&1; then
    DEPS_OK="true"
    log "pnpm install succeeded"
  else
    log "pnpm install failed"
    return
  fi

  # Verify native module (better-sqlite3)
  log "Verifying native modules"
  if node -e "require('better-sqlite3')" >> "$LOG_FILE" 2>&1; then
    NATIVE_OK="true"
    log "better-sqlite3 loads OK"
  else
    log "better-sqlite3 failed to load"
  fi
}

# --- Build tools check ---

check_build_tools() {
  HAS_BUILD_TOOLS="false"

  if [ "$PLATFORM" = "macos" ]; then
    if xcode-select -p >/dev/null 2>&1; then
      HAS_BUILD_TOOLS="true"
    fi
  elif [ "$PLATFORM" = "linux" ]; then
    if command -v gcc >/dev/null 2>&1 && command -v make >/dev/null 2>&1; then
      HAS_BUILD_TOOLS="true"
    fi
  fi

  log "Build tools: $HAS_BUILD_TOOLS"
}

# --- Fork composition (nv-* merge train) ---
#
# A stock nanoclaw clone has no nv-* branches on origin, so this is a NO-OP and
# `bash setup.sh` behaves exactly like upstream. A fork clone (the nv-coworkers
# checkout) gets nv-main merged in here — BEFORE install_deps, so the composed
# package.json/pnpm-lock.yaml drive the frozen install. Optional project
# overlays (nv-slang, …) are offered later by the wizard's project-integrations
# step. This is step (b) of the clone → setup.sh(nv-main) → wizard(projects) flow.
#
# The nv-main merge is inlined here rather than delegated to
# setup/merge-train.sh, because on a fresh nv-coworkers clone that script does
# not exist yet (it arrives WITH nv-main). Keep fork_is_owned() in sync with the
# is_owned() in setup/merge-train.sh and .github/workflows/ci.yml.

# Files nv-main is canonical for — safe to take from nv-main's side on conflict.
# SINGLE source of truth: nv-main's path-guard allowlist
# (.github/nv-path-guard/nv-main.txt), evaluated by nv-main's OWN matcher
# (.github/nv-path-guard/ownership.py) — the same module CI's path-guard imports.
# Both are extracted from origin/nv-main by compose_fork once it has fetched.
#
# This used to run `git -c core.excludesFile=<list> check-ignore` HERE, in the
# project repo, which also consults this repo's .gitignore, .git/info/exclude and
# the user's global excludes. This repo's .gitignore alone would then hand
# nv-main ownership of groups/**, data/**, logs/**, coworkers/*.yaml, repos/**
# and forks.md — so a conflict there would be "resolved" by overwriting the
# user's own files with nv-main's. The shared matcher sees the allowlist only.
NV_OWNED_LIST=""
NV_MATCHER=""

# NUL-delimited candidates on stdin → NUL-delimited owned paths on stdout, one
# call for the whole batch.
nv_owned() {
  [ -n "$NV_OWNED_LIST" ] && [ -s "$NV_OWNED_LIST" ] || return 1
  [ -n "$NV_MATCHER" ] && [ -s "$NV_MATCHER" ] || return 1
  python3 "$NV_MATCHER" -0 "$NV_OWNED_LIST"
}

# Exact membership in a NUL-delimited set file. Not `grep -zxF`: `-z` is GNU-only
# and means "decompress" in ugrep, which shadows grep on some developer PATHs.
nv_set_has() {
  local set_file="$1" want="$2" got
  while IFS= read -r -d '' got; do
    [ "$got" = "$want" ] && return 0
  done < "$set_file"
  return 1
}

compose_fork() {
  command -v git >/dev/null 2>&1 || return 0
  cd "$PROJECT_ROOT" || return 0
  git rev-parse --git-dir >/dev/null 2>&1 || return 0
  # Fork detection: only a fork remote carries nv-main. Vanilla → return here.
  git ls-remote --exit-code --heads origin nv-main >/dev/null 2>&1 || return 0

  git fetch origin nv-main >>"$LOG_FILE" 2>&1 || {
    log "compose_fork: could not fetch origin/nv-main — skipping"
    return 0
  }
  if git merge-base --is-ancestor origin/nv-main HEAD 2>/dev/null; then
    log "compose_fork: origin/nv-main already merged — skipping"
    return 0
  fi

  # Load nv-main's owned-file allowlist AND its matcher now that origin/nv-main
  # is fetched, so ownership is decided from the single source of truth by the
  # single implementation of it.
  NV_OWNED_LIST="$(mktemp)"
  git show origin/nv-main:.github/nv-path-guard/nv-main.txt > "$NV_OWNED_LIST" 2>/dev/null || true
  NV_MATCHER="$(mktemp)"
  git show origin/nv-main:.github/nv-path-guard/ownership.py > "$NV_MATCHER" 2>/dev/null || true

  # Fail LOUD. Every answer below drives either "abort the compose" or "overwrite
  # this file from nv-main". A matcher that cannot run would silently make both
  # no-ops, composing a tree with the stale copies this exists to replace — the
  # dependsOn/TS2353 and create-agent.ts/TS2740 class of break.
  if ! printf 'probe\0' | nv_owned >/dev/null 2>&1; then
    echo "setup.sh: cannot evaluate nv-main ownership — python3 is required to compose" >&2
    echo "the coworker infrastructure (it runs nv-main's .github/nv-path-guard/ownership.py)." >&2
    echo "Install python3 and re-run: bash setup.sh" >&2
    exit 1
  fi

  log "compose_fork: merging origin/nv-main into $(git rev-parse --abbrev-ref HEAD)"
  echo "Composing coworker infrastructure (merging nv-main)…"
  # A merge commit needs an identity; only set a fallback if none is configured.
  git config user.name  >/dev/null 2>&1 || git config user.name  "nanoclaw-setup"
  git config user.email >/dev/null 2>&1 || git config user.email "setup@nanoclaw.local"

  if ! git merge origin/nv-main --no-edit >>"$LOG_FILE" 2>&1; then
    conflicts="$(git diff --name-only --diff-filter=U)"
    conflicts_owned="$(mktemp)"
    printf '%s\0' $conflicts | nv_owned > "$conflicts_owned" || : > "$conflicts_owned"
    unexpected=""
    for f in $conflicts; do
      nv_set_has "$conflicts_owned" "$f" || unexpected="$unexpected $f"
    done
    rm -f "$conflicts_owned"
    if [ -n "$unexpected" ]; then
      git merge --abort
      echo "setup.sh: cannot auto-compose nv-main — conflicts outside nv-main's owned set:" >&2
      printf '  %s\n' $unexpected >&2
      echo "Resolve manually: git merge origin/nv-main   (see logs/bootstrap.log)" >&2
      exit 1
    fi
    for f in $conflicts; do
      if git checkout origin/nv-main -- "$f" 2>/dev/null; then
        git add -- "$f"
      else
        git rm -f -- "$f" >/dev/null 2>&1 || rm -f "$f"
        git add -A -- "$f"
      fi
    done
    git commit --no-edit >>"$LOG_FILE" 2>&1
  fi

  # The ENTIRE owned set is canonical to nv-main. nv-coworkers tracks upstream,
  # not nv-main, so it carries stale copies of nv-main-owned files; a stale copy
  # that AUTO-merges (doesn't conflict) is kept and then dangles against nv-main's
  # evolved code, or desyncs package.json from the lockfile
  # (ERR_PNPM_OUTDATED_LOCKFILE). After the merge, overwrite every owned file that
  # EXISTS on nv-main and differs here to nv-main's version. nv-coworkers-NEW
  # owned files (absent on nv-main) are left untouched. See setup/compose-fork.test.ts.
  # One matcher call for the whole diff, then walk the OWNED set directly instead
  # of asking "is this owned?" per file. NUL-delimited end to end.
  owned_diff="$(mktemp)"
  git diff --name-only -z origin/nv-main HEAD | nv_owned > "$owned_diff" || : > "$owned_diff"
  while IFS= read -r -d '' f; do
    [ -z "$f" ] && continue
    git cat-file -e "origin/nv-main:$f" 2>/dev/null || continue
    git checkout origin/nv-main -- "$f"
  done < "$owned_diff"
  rm -f "$owned_diff"
  if ! git diff --cached --quiet 2>/dev/null; then
    git commit -q --amend --no-edit >>"$LOG_FILE" 2>&1
  fi

  # The merge just rewrote setup.sh itself (nv-main is canonical for it). bash
  # reads scripts incrementally, so continuing in this process could execute a
  # mix of old and new bytes — re-exec the freshly merged copy. NANOCLAW_COMPOSED
  # guards against re-entry (the re-run sees nv-main already merged anyway).
  log "compose_fork: re-exec after merge"
  export NANOCLAW_COMPOSED=1
  exec bash "$PROJECT_ROOT/setup.sh" "$@"
}

# --- Main ---

log "=== Bootstrap started ==="

detect_platform

check_node
if [ "$NODE_OK" = "false" ]; then
  log "Node missing or too old — running setup/install-node.sh"
  echo "Node 22+ not found — installing via setup/install-node.sh"
  if bash "$PROJECT_ROOT/setup/install-node.sh" 2>&1 | tee -a "$LOG_FILE"; then
    if [ -x "$HOME/.local/bin/node" ]; then
      export PATH="$HOME/.local/bin:$PATH"
    elif [ "$PLATFORM" = "macos" ] && command -v brew >/dev/null 2>&1; then
      if NODE22_PREFIX="$(brew --prefix node@22 2>/dev/null)"; then
        export PATH="$NODE22_PREFIX/bin:$PATH"
      fi
    fi
    hash -r 2>/dev/null || true
    check_node
  else
    log "install-node.sh failed"
  fi
fi

# Compose the fork (merge nv-main) BEFORE installing deps, so the frozen install
# resolves the composed lockfile. No-op on a stock clone; on a fork clone this
# may re-exec setup.sh once (guarded by NANOCLAW_COMPOSED).
if [ "${NANOCLAW_COMPOSED:-}" != "1" ]; then
  compose_fork "$@"
fi

# NANOCLAW_COMPOSE_ONLY lets tests exercise compose_fork against a synthetic repo
# without the Node install/build tail. Never set in real setup.
if [ -n "${NANOCLAW_COMPOSE_ONLY:-}" ]; then
  log "compose-only: exiting after compose_fork"
  exit 0
fi

install_deps
check_build_tools

# Emit status block
STATUS="success"
if [ "$NODE_OK" = "false" ]; then
  STATUS="node_missing"
elif [ "$DEPS_OK" = "false" ]; then
  STATUS="deps_failed"
elif [ "$NATIVE_OK" = "false" ]; then
  STATUS="native_failed"
fi

# Anonymous setup start event (non-blocking, best-effort). Uses the
# persisted distinct_id from data/install-id so bash-side events and the
# node-side funnel share one id.
# shellcheck source=setup/lib/diagnostics.sh
source "$PROJECT_ROOT/setup/lib/diagnostics.sh"
ph_event setup_start \
  platform="$PLATFORM" \
  is_wsl="$IS_WSL" \
  is_root="$IS_ROOT" \
  node_version="$NODE_VERSION" \
  deps_ok="$DEPS_OK" \
  native_ok="$NATIVE_OK" \
  has_build_tools="$HAS_BUILD_TOOLS" \
  status="$STATUS"

cat <<EOF
=== NANOCLAW SETUP: BOOTSTRAP ===
PLATFORM: $PLATFORM
IS_WSL: $IS_WSL
IS_ROOT: $IS_ROOT
NODE_VERSION: $NODE_VERSION
NODE_OK: $NODE_OK
NODE_PATH: ${NODE_PATH_FOUND:-not_found}
DEPS_OK: $DEPS_OK
NATIVE_OK: $NATIVE_OK
HAS_BUILD_TOOLS: $HAS_BUILD_TOOLS
STATUS: $STATUS
LOG: logs/setup.log
=== END ===
EOF

log "=== Bootstrap completed: $STATUS ==="

if [ "$NODE_OK" = "false" ]; then
  exit 2
fi
if [ "$DEPS_OK" = "false" ] || [ "$NATIVE_OK" = "false" ]; then
  exit 1
fi
