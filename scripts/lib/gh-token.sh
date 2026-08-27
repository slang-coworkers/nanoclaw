#!/usr/bin/env bash
# Shared GitHub-token resolution for host-side scripts (fetch-skills.sh,
# refresh-skills-cron.sh). Source it; do not execute it.
#
# WHY THIS EXISTS
# ---------------
# `gh` does not require a token. With none present it degrades in two
# *different* ways, and both are silent in their own way:
#
#   * `gh api`           → refuses, rc=4, "please run gh auth login" on stderr.
#     fetch-skills.sh piped that to /dev/null and `|| echo ""`, so an empty
#     result read as "sha check failed; cache assumed current" → skip → exit 0.
#   * `gh skill install` → proceeds ANONYMOUSLY (verified: rc=0, skill installed
#     with no token at all). Anonymous is 60 requests/hour per IP. Past that
#     every install 403s, the script printed a warning and still exited 0.
#
# A partial fetch that exits 0 corrupts the next deploy: the missing skills only
# surface much later as a spine-compose error
# ("references unknown skill/workflow/overlay: slangpy-build, ...").
#
# So: never rely on an interactive `gh auth login` having persisted. Resolve a
# token explicitly, prove it can read the target repo, and fail loudly if not.
#
# RESOLUTION ORDER (first hit wins)
#   1. GH_TOKEN / GITHUB_TOKEN already exported (CI passes secrets.GITHUB_TOKEN).
#   2. `gh auth token` — requires `gh auth status` to actually succeed first.
#   3. ~/.config/nanoclaw/gh-app-token.py --install-id <id> — the GitHub App
#      installation-token minter deployed on lego and prod; the same one
#      scripts/funnel.ts uses for its shader-slang/* reads.
# There is deliberately no anonymous fallback.

# App installation IDs by repo owner — same map as scripts/funnel.ts.
GH_APP_TOKEN_SCRIPT="${GH_APP_TOKEN_SCRIPT:-$HOME/.config/nanoclaw/gh-app-token.py}"

gh_install_id_for_owner() {
  case "$1" in
    shader-slang) echo "122982130" ;;
    slang-coworkers) echo "123550981" ;;
    *) echo "" ;;
  esac
}

# True when gh's combined output looks like a rate-limit / throttle rejection.
gh_output_is_throttled() {
  printf '%s' "${1:-}" | grep -qiE 'rate limit|secondary rate|abuse detection|HTTP 403|HTTP 429'
}

# True when gh's combined output looks like an auth rejection (incl. the
# "you have no token at all" nudge gh prints instead of going anonymous).
gh_output_is_unauthenticated() {
  printf '%s' "${1:-}" | grep -qiE 'HTTP 401|bad credentials|gh auth login|authentication token|requires authentication'
}

# resolve_gh_token <owner>
#
# Sets and exports GH_TOKEN, and sets GH_TOKEN_SOURCE for logging.
# Returns 0 on success, 1 on failure (message on stderr).
#
# Call it BARE — `resolve_gh_token shader-slang` — never inside $(...). A command
# substitution runs the function in a subshell, so the exported GH_TOKEN would be
# discarded the moment the subshell exits.
resolve_gh_token() {
  local owner="${1:-}"
  local tok="" rc

  if [ -n "${GH_TOKEN:-}" ]; then
    GH_TOKEN_SOURCE="env:GH_TOKEN"
    export GH_TOKEN
    return 0
  fi
  if [ -n "${GITHUB_TOKEN:-}" ]; then
    GH_TOKEN="$GITHUB_TOKEN"
    GH_TOKEN_SOURCE="env:GITHUB_TOKEN"
    export GH_TOKEN
    return 0
  fi

  # `gh auth token` exits 0 and prints NOTHING when logged out (verified), so
  # its rc is worthless on its own. Gate on `gh auth status` (rc=1 logged out,
  # rc=0 logged in) and then require a non-empty token.
  if command -v gh >/dev/null 2>&1; then
    gh auth status >/dev/null 2>&1
    rc=$?
    if [ "$rc" -eq 0 ]; then
      tok=$(gh auth token 2>/dev/null)
      if [ -n "$tok" ]; then
        GH_TOKEN="$tok"
        GH_TOKEN_SOURCE="gh auth status"
        export GH_TOKEN
        return 0
      fi
    fi
  fi

  local install_id
  install_id=$(gh_install_id_for_owner "$owner")
  if [ -z "$install_id" ]; then
    echo "✗ no GitHub token and no App installation known for owner '$owner'" >&2
    return 1
  fi
  if [ ! -f "$GH_APP_TOKEN_SCRIPT" ]; then
    echo "✗ no GitHub token: gh is logged out and $GH_APP_TOKEN_SCRIPT is missing" >&2
    return 1
  fi

  tok=$(python3 "$GH_APP_TOKEN_SCRIPT" --install-id "$install_id" 2>&1)
  rc=$?
  if [ "$rc" -ne 0 ] || [ -z "$tok" ]; then
    echo "✗ gh-app-token.py --install-id $install_id failed (rc=$rc)" >&2
    printf '%s\n' "$tok" | sed 's/^/    | /' >&2
    return 1
  fi

  GH_TOKEN="$tok"
  GH_TOKEN_SOURCE="gh-app-token.py --install-id $install_id ($owner)"
  export GH_TOKEN
  return 0
}

# gh_probe_repo_readable <owner/repo>
#
# One API call that proves the resolved token can actually READ the target repo.
# This is the empirical answer to "can a GitHub App installation token read a
# repo outside its installation?" — we do not guess, we ask, on the box, with
# the token that the real run will use. Returns 0 if readable.
gh_probe_repo_readable() {
  local repo="${1:-}" out rc
  out=$(gh api "repos/$repo" --jq '.full_name' 2>&1)
  rc=$?
  if [ "$rc" -eq 0 ] && [ "$out" = "$repo" ]; then
    return 0
  fi
  echo "✗ token cannot read $repo (rc=$rc)" >&2
  printf '%s\n' "$out" | sed 's/^/    | /' >&2
  if gh_output_is_throttled "$out"; then
    echo "  → RATE LIMITED. Check: gh api rate_limit --jq .resources.core" >&2
  elif gh_output_is_unauthenticated "$out"; then
    echo "  → token rejected. If it came from gh-app-token.py, the App installation" >&2
    echo "    cannot reach this repo; use the nv-slang-bot PAT instead (export GH_TOKEN)." >&2
  fi
  return 1
}
