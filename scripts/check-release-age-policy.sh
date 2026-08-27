#!/usr/bin/env bash
#
# Assert that the release-age quarantine is actually VISIBLE TO PNPM.
#
# The policy was documented, committed, and inert. `minimumReleaseAge: 4320`
# sat nested under a `pnpm:` key in pnpm-workspace.yaml; the pinned pnpm
# 10.33.0 reads that setting only at the TOP level and ignores the nested form
# — silently, with no warning of any kind. Nothing in the repo could tell the
# difference between "three-day quarantine enforced" and "three-day quarantine
# is a comment", which is how @openai/codex@0.146.1 (published 14.6 hours
# before merge) got in.
#
# So this check does not read the policy and nod. It makes pnpm demonstrate
# that it is enforcing something, in three parts:
#
#   1. STRUCTURAL — the key is top-level in pnpm-workspace.yaml, is a positive
#      number, and appears nowhere indented (re-nesting under `pnpm:`, or under
#      anything else, fails here).
#   2. POSITIVE PROBE — a throwaway project using the SAME pnpm, with the key
#      at the location this repo uses, MUST refuse a package version older than
#      its window. If this passes when it should refuse, the location has
#      stopped working (e.g. a pnpm upgrade moved it) and the quarantine is off.
#   3. NEGATIVE CONTROL — the same probe with the key nested MUST succeed.
#      Without this the positive probe could be passing for an unrelated reason
#      (a stray global config, a registry error) and we would be re-running the
#      original bug as a green check.
#
# The probe resolves metadata only (--lockfile-only) for a package this repo
# already depends on, so it introduces no new package into the trust surface
# and downloads no tarball.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKSPACE_YAML="$REPO_ROOT/pnpm-workspace.yaml"
# Minimum acceptable window, in minutes. The repo policy is three days.
REQUIRED_MINUTES=4320
# A version far older than any plausible window, used to force the refusal.
# Already a devDependency here — nothing new enters the trust surface.
PROBE_SPEC="typescript@5.9.3"
# ~190 years. Guarantees the probe's outcome depends on whether the setting is
# read at all, never on the actual age of the package.
PROBE_AGE=99999999

fail() {
  echo "::error::release-age policy: $*" >&2
  echo "FAIL: $*" >&2
  exit 1
}

command -v pnpm >/dev/null 2>&1 || fail "pnpm is not on PATH"
echo "pnpm $(pnpm --version)"

# ---- 1. structural -----------------------------------------------------------
[ -f "$WORKSPACE_YAML" ] || fail "$WORKSPACE_YAML not found"

if grep -nE '^[[:space:]]+minimumReleaseAge' "$WORKSPACE_YAML"; then
  fail "minimumReleaseAge is INDENTED in pnpm-workspace.yaml (shown above).
  pnpm reads it only as a top-level key and ignores nested forms without warning.
  Move it to column 0."
fi

configured=$(sed -nE 's/^minimumReleaseAge:[[:space:]]*([0-9]+)[[:space:]]*$/\1/p' "$WORKSPACE_YAML")
[ -n "$configured" ] || fail "no top-level 'minimumReleaseAge: <minutes>' in pnpm-workspace.yaml"
[ "$configured" -ge "$REQUIRED_MINUTES" ] ||
  fail "minimumReleaseAge is ${configured} minutes; policy requires at least ${REQUIRED_MINUTES} (three days)"
echo "structural: minimumReleaseAge=${configured} at top level — OK"

# ---- 1b. the in-image install path declares the same floor -------------------
# The agent container's global installs (`pnpm install -g`) resolve config from
# /root/.npmrc and never read pnpm-workspace.yaml, so container/install-cli-tools.sh
# has to state the floor itself. A second copy of a number is a drift hazard —
# exactly the shape of the duplicated Codex pin that F01 removed — so the two
# must agree, checked here rather than trusted.
INSTALLER="$REPO_ROOT/container/install-cli-tools.sh"
if [ -f "$INSTALLER" ]; then
  in_image=$(sed -nE 's/^MIN_RELEASE_AGE=([0-9]+).*/\1/p' "$INSTALLER")
  [ -n "$in_image" ] ||
    fail "container/install-cli-tools.sh has no MIN_RELEASE_AGE=<minutes>.
  The in-image global installs would run unquarantined — that is the half of F01
  the workspace setting cannot cover."
  [ "$in_image" = "$configured" ] ||
    fail "release-age floor has drifted: pnpm-workspace.yaml says ${configured} minutes,
  container/install-cli-tools.sh says ${in_image}. They govern different install
  paths and must state the same policy."
  grep -q 'ERR_PNPM_NO_MATURE_MATCHING_VERSION' "$INSTALLER" ||
    fail "container/install-cli-tools.sh no longer probes that the gate is in force.
  Writing the setting is not evidence it applies — that was the whole finding."
  echo "in-image: install-cli-tools.sh declares ${in_image} and probes enforcement — OK"
fi

# ---- probe harness -----------------------------------------------------------
PROBE_ROOT="$(mktemp -d)"
trap 'rm -rf "$PROBE_ROOT"' EXIT

# Isolate the probes from every config they could otherwise inherit — the repo's
# own .npmrc, the user's, the machine's. Only the fixture's pnpm-workspace.yaml
# may influence the outcome, or the negative control proves nothing.
: > "$PROBE_ROOT/empty-npmrc"
export npm_config_userconfig="$PROBE_ROOT/empty-npmrc"
export npm_config_globalconfig="$PROBE_ROOT/empty-npmrc"

# $1 = fixture dir name, $2 = the pnpm-workspace.yaml body
probe() {
  local dir="$PROBE_ROOT/$1"
  mkdir -p "$dir"
  printf '{"name":"release-age-probe","version":"1.0.0","private":true}\n' > "$dir/package.json"
  printf '%s\n' "$2" > "$dir/pnpm-workspace.yaml"
  ( cd "$dir" && pnpm add "$PROBE_SPEC" --lockfile-only ) > "$dir/out.log" 2>&1
  return $?
}

# ---- 2. positive probe -------------------------------------------------------
if probe toplevel "$(printf 'packages:\n  - "."\n\nminimumReleaseAge: %s' "$PROBE_AGE")"; then
  fail "pnpm $(pnpm --version) IGNORED a top-level minimumReleaseAge — the quarantine is NOT in force.
  The supported location has changed. Find where this pnpm reads it and move the
  setting there, then update this check."
fi
if ! grep -q 'ERR_PNPM_NO_MATURE_MATCHING_VERSION' "$PROBE_ROOT/toplevel/out.log"; then
  echo "--- probe output ---" >&2
  cat "$PROBE_ROOT/toplevel/out.log" >&2
  fail "the probe failed for some reason OTHER than the release-age gate (registry down?).
  This check cannot confirm the policy is in force, so it will not report success."
fi
echo "positive probe: top-level minimumReleaseAge refused ${PROBE_SPEC} — OK"

# ---- 3. negative control -----------------------------------------------------
if probe nested "$(printf 'packages:\n  - "."\n\npnpm:\n  minimumReleaseAge: %s' "$PROBE_AGE")"; then
  echo "negative control: nested minimumReleaseAge was ignored, as expected — OK"
else
  if grep -q 'ERR_PNPM_NO_MATURE_MATCHING_VERSION' "$PROBE_ROOT/nested/out.log"; then
    # Not a failure of this repo: it means pnpm started honouring the nested
    # form too, so the positive probe no longer distinguishes the locations.
    fail "this pnpm honours the NESTED form as well, so the positive probe no longer
  discriminates. Both locations now work; simplify this check deliberately
  rather than leaving a probe that cannot fail."
  fi
  echo "--- negative control output ---" >&2
  cat "$PROBE_ROOT/nested/out.log" >&2
  fail "the negative control failed for an unrelated reason — the probe environment is
  not clean, so the positive result above cannot be trusted."
fi

echo "release-age policy is in force: minimumReleaseAge=${configured} minutes, verified against pnpm $(pnpm --version)"
