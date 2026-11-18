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

# shellcheck source=setup/lib/node-version.sh
source "$PROJECT_ROOT/setup/lib/node-version.sh"
# shellcheck source=setup/lib/jq.sh
source "$PROJECT_ROOT/setup/lib/jq.sh"

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

# --- Why a tool failed ---

# Tools write straight to the log, and the one line for the screen is read
# back from it.

# log_end_line: a tool may end without a newline; what the log gets next
# must start on a line of its own.
log_end_line() {
  [ -z "$(tail -c 1 "$LOG_FILE" 2>/dev/null)" ] || echo >> "$LOG_FILE"
}

# log_mark: LOG_MARK is how many lines the log holds now. It is left empty
# when they cannot be counted, and log_error_line then gives nothing: better
# no line than one from an earlier step.
log_mark() {
  log_end_line
  if [ -e "$LOG_FILE" ]; then
    LOG_MARK=$(wc -l 2>/dev/null < "$LOG_FILE") || LOG_MARK=""
  else
    LOG_MARK=0
  fi
  # BSD wc pads the count with spaces.
  LOG_MARK="${LOG_MARK//[[:space:]]/}"
  case "$LOG_MARK" in
    *[!0-9]*) LOG_MARK="" ;;
  esac
}

# log_error_line: sets ERROR_LINE to the first line the log gained since
# log_mark that names an error, else to the first with anything on it.
log_error_line() {
  local line n=0
  ERROR_LINE=""
  [ -n "${LOG_MARK:-}" ] || return 0
  [ -r "$LOG_FILE" ] || return 0
  log_end_line
  while IFS= read -r line; do
    n=$((n + 1))
    [ "$n" -gt "$LOG_MARK" ] || continue
    [ -n "$ERROR_LINE" ] || ERROR_LINE="$line"
    case "$line" in
      *[Ee]rror* | *ERR!*) ERROR_LINE="$line"; return 0 ;;
    esac
  done < "$LOG_FILE"
  return 0
}

# --- Node.js check ---

check_node() {
  NODE_OK="false"
  NODE_VERSION="not_found"
  NODE_PATH_FOUND=""
  NODE_START_ERROR=""

  if command -v node >/dev/null 2>&1; then
    NODE_PATH_FOUND=$(command -v node)
    # Guarded: under `set -e` a Node that cannot start (built for another
    # libc, a broken download) would end the bootstrap here with nothing said.
    # Run once: what it prints on stderr goes to the log.
    log_mark
    if NODE_VERSION=$(node --version 2>>"$LOG_FILE"); then
      NODE_VERSION="${NODE_VERSION#v}"
      if node_meets_minimum "$NODE_VERSION"; then
        NODE_OK="true"
      fi
      log "Node $NODE_VERSION at $NODE_PATH_FOUND (ok=$NODE_OK)"
    else
      # Its stdout may hold the error too.
      [ -z "$NODE_VERSION" ] || printf '\n%s\n' "$NODE_VERSION" >> "$LOG_FILE"
      NODE_VERSION="cannot_start"
      log_error_line
      NODE_START_ERROR="$ERROR_LINE"
      log "Node at $NODE_PATH_FOUND cannot start: ${NODE_START_ERROR:-it printed nothing}"
    fi
  else
    log "Node not found"
  fi
}

# --- Node.js install ---

ensure_node() {
  check_node
  # An earlier install may have left a Node that meets the minimum off PATH.
  if [ "$NODE_OK" = "false" ] && node_use_patched; then
    check_node
  fi
  # install-node.sh decides what to install from the version of the PATH Node.
  # One that cannot start has none to give, so nothing is installed over it.
  if [ "$NODE_OK" = "false" ] && [ "$NODE_VERSION" != "cannot_start" ]; then
    log "Node missing or too old — running setup/install-node.sh"
    echo "Node is missing or below the minimum (${NODE_MINIMUMS// / / }) — installing via setup/install-node.sh"
    if bash "$PROJECT_ROOT/setup/install-node.sh" 2>&1 | tee -a "$LOG_FILE"; then
      node_use_patched || true
      check_node
    else
      log "install-node.sh failed"
    fi
  fi
  # Say why and what to do; the status block ends the run as node_missing.
  if [ "$NODE_VERSION" = "cannot_start" ]; then
    echo "Node at $NODE_PATH_FOUND cannot start:"
    echo "  ${NODE_START_ERROR:-it printed nothing}"
    echo "Remove it, or put a Node that works (${NODE_MINIMUMS// / / } or newer) ahead of it on PATH, then re-run setup."
  fi
}

# --- jq (skills read API replies with it) ---

install_jq() {
  JQ_OK="false"
  if ensure_jq >> "$LOG_FILE" 2>&1; then
    JQ_OK="true"
  fi
  log "jq: $JQ_OK"
}

# --- pnpm install ---

install_deps() {
  DEPS_OK="false"
  NATIVE_OK="false"
  # Set where a try that needs no root fails: why pnpm is missing, the tool's
  # own error line and what to do. The message at the end prints the last one.
  local pnpm_why="" pnpm_error="" pnpm_todo=""

  if [ "$NODE_OK" = "false" ]; then
    log "Skipping pnpm install — Node not available"
    return
  fi

  cd "$PROJECT_ROOT"

  # Corepack's first-use "Do you want to continue? [Y/n]" prompt would hang
  # the script since we redirect stdout/stderr to the log file — the prompt
  # is invisible but corepack still blocks on stdin. Auto-accept.
  export COREPACK_ENABLE_DOWNLOAD_PROMPT=0

  # The pnpm lookups below append to PATH, so a node in those dirs can't
  # shadow the one check_node accepted.

  # A previous run (or the manual recovery printed below) may have left pnpm
  # in ~/.local/bin, which a fresh login shell doesn't always have on PATH.
  if ! command -v pnpm >/dev/null 2>&1 && [ -x "$HOME/.local/bin/pnpm" ]; then
    export PATH="$PATH:$HOME/.local/bin"
    log "Found pnpm in $HOME/.local/bin — appended to PATH"
  fi

  # Preferred path: enable corepack so `pnpm` shim lands on PATH.
  if command -v corepack >/dev/null 2>&1; then
    log "Enabling corepack"
    corepack enable >> "$LOG_FILE" 2>&1 || true

    # With system-wide Node (e.g. apt-installed to /usr/bin), corepack puts
    # its shims next to the node binary, so a non-root user gets EACCES on
    # /usr/bin/pnpm. Retry into ~/.local/bin, which needs no root — nanoclaw.sh
    # and the service unit already carry it on PATH.
    if ! command -v pnpm >/dev/null 2>&1; then
      local user_bin="$HOME/.local/bin"
      log "pnpm not on PATH after corepack enable — retrying into $user_bin"
      log_mark
      if ! mkdir -p "$user_bin" >> "$LOG_FILE" 2>&1; then
        pnpm_why="$user_bin cannot be created"
        log_error_line
        pnpm_error="$ERROR_LINE"
        pnpm_todo="Fix that, then re-run setup. mkdir's full output is in $LOG_FILE"
        log "Could not create $user_bin: $pnpm_error"
      elif corepack enable --install-directory "$user_bin" pnpm >> "$LOG_FILE" 2>&1 \
          && [ -x "$user_bin/pnpm" ]; then
        export PATH="$PATH:$user_bin"
        hash -r 2>/dev/null || true
        log "corepack pnpm shim installed in $user_bin"
      else
        # This try needs no root, so what corepack said is why pnpm is missing.
        pnpm_why="corepack could not put pnpm into $user_bin"
        log_error_line
        pnpm_error="$ERROR_LINE"
        pnpm_todo="Fix that, then re-run setup. corepack's full output is in $LOG_FILE"
        log "corepack enable into $user_bin failed"
      fi
    fi

    # Last resort before the npm fallback: passwordless sudo. `-n` never
    # prompts — output is redirected to the log, so a password prompt would
    # be invisible and block until sudo times out. macOS Homebrew installs
    # land in a user-writable prefix, and a sudo retry there would create
    # root-owned shims inside /opt/homebrew that later break brew — so the
    # retry is Linux-only.
    if ! command -v pnpm >/dev/null 2>&1 && [ "$PLATFORM" = "linux" ] \
        && command -v sudo >/dev/null 2>&1; then
      log "pnpm still not on PATH — retrying corepack enable with sudo -n"
      if ! sudo -n corepack enable >> "$LOG_FILE" 2>&1; then
        log "sudo -n corepack enable failed (sudo needs a password, or corepack errored)"
      fi
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
    if ! npm install -g "pnpm@${pinned}" >> "$LOG_FILE" 2>&1; then
      # sudo can't prompt here (output goes to the log) — use a user-owned
      # prefix instead. ~/.local puts pnpm in ~/.local/bin, which nanoclaw.sh
      # and the service unit already have on PATH.
      log "npm install -g failed — retrying with a user-owned prefix"
      NPM_LOCAL_PREFIX="$HOME/.local"
      log_mark
      if ! mkdir -p "$NPM_LOCAL_PREFIX" >> "$LOG_FILE" 2>&1; then
        pnpm_why="$NPM_LOCAL_PREFIX cannot be created"
        log_error_line
        pnpm_error="$ERROR_LINE"
        pnpm_todo="Fix that, then re-run setup. mkdir's full output is in $LOG_FILE"
        log "Could not create $NPM_LOCAL_PREFIX: $pnpm_error"
      elif npm install -g "pnpm@${pinned}" --prefix "$NPM_LOCAL_PREFIX" >> "$LOG_FILE" 2>&1; then
        export PATH="$PATH:$NPM_LOCAL_PREFIX/bin"
        log "Installed pnpm@${pinned} to user-owned prefix: $NPM_LOCAL_PREFIX"
      else
        # This try needs no root, so what npm said is why pnpm is missing.
        log_error_line
        pnpm_error="$ERROR_LINE"
        if npm --version >/dev/null 2>&1; then
          pnpm_why="npm failed, also when installing into ~/.local"
          pnpm_todo="Fix that, then re-run setup. npm's full output is in $LOG_FILE"
        else
          pnpm_why="npm at $(command -v npm) cannot run"
          pnpm_todo="Reinstall Node.js to get a working npm, then re-run setup."
        fi
        log "pnpm install via user-owned prefix also failed"
      fi
    fi
  fi

  # `npm install -g` writes to npm's global prefix, which isn't always on the
  # shell PATH — common on macOS where the user has `npm config set prefix
  # ~/.npm-global` to avoid sudo, or on Linux where /usr/local/bin isn't in
  # PATH. Discover the prefix and append its bin dir so `command -v pnpm`
  # sees the new install.
  if ! command -v pnpm >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
    local npm_prefix
    # Guarded: under `set -e` a failing npm would end the bootstrap right here,
    # before the lines below say why pnpm is missing.
    npm_prefix=$(npm config get prefix 2>/dev/null) || log "npm config get prefix failed"
    if [ -n "$npm_prefix" ] && [ -x "$npm_prefix/bin/pnpm" ]; then
      export PATH="$PATH:$npm_prefix/bin"
      log "Appended npm prefix bin to PATH: $npm_prefix/bin"
    fi
  fi

  if ! command -v pnpm >/dev/null 2>&1; then
    log "pnpm not on PATH after corepack + npm fallback"
    if [ -n "$pnpm_why" ]; then
      # Root is not what is missing here, and the command suggested below
      # would fail the same way. Show the real reason instead.
      echo "Could not install pnpm: $pnpm_why:"
      echo "  ${pnpm_error:-it printed nothing}"
      echo "$pnpm_todo"
      return
    fi
    if ! command -v corepack >/dev/null 2>&1 && ! command -v npm >/dev/null 2>&1; then
      echo "Could not install pnpm: there is no corepack and no npm on PATH to install it with."
      echo "Reinstall Node.js, which brings npm, then re-run setup."
      return
    fi
    # Left: npm's global install reported success, yet pnpm is nowhere this
    # script looks. The try into ~/.local was not made, so suggest it.
    echo "Could not install pnpm without root. Run this, then re-run setup:"
    echo "  npm install -g pnpm@${pinned:-<version from package.json packageManager>} --prefix ~/.local"
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
        # `git rm -f` stages the deletion itself, so add -A after it SUCCEEDS
        # is fatal rather than redundant: the path is gone from worktree and
        # index, git answers `pathspec did not match any files` and exits 128 —
        # under this script's `set -e` that aborts the whole bootstrap.
        git rm -f -- "$f" >/dev/null 2>&1 || { rm -f "$f"; git add -A -- "$f"; }
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

ensure_node

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

# Hosts the generic flow cannot prepare on its own (today: NVIDIA agent sandbox
# VMs) are recognised and prepared here, after compose_fork so the freshly
# merged prep runs. A no-op everywhere else; NANOCLAW_HOST_PROFILE=none skips it.
# shellcheck source=setup/host-profile.sh
source "$PROJECT_ROOT/setup/host-profile.sh"
if ! nanoclaw_apply_host_profile "$PROJECT_ROOT"; then
  log "host profile prep failed"
  echo "Host preparation failed — see the output above" >&2
  exit 1
fi

install_jq
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
JQ_OK: $JQ_OK
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
