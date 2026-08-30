#!/bin/sh
# Install the global Node CLIs the agent invokes at runtime, from cli-tools.json.
#
# A skill adds a tool by appending a { "name", "version" } entry to that
# manifest (a json-merge) instead of editing the Dockerfile — the reach-in
# becomes the safest change shape, deterministic and removable.
#
# Every tool is installed via `pnpm install -g`, pinned to an exact version.
# Run as root before `USER node`, so /root/.npmrc is the right home.
#
# RELEASE-AGE QUARANTINE. This script used to claim "the pnpm supply-chain
# policy still applies" to these installs. It did not. A global install resolves
# config from /root/.npmrc and never reads the repository's pnpm-workspace.yaml,
# so the three-day quarantine documented at the top level had no effect on the
# packages that actually run inside the agent container — which is how
# @openai/codex 0.146.1 entered the image about 14.6 hours after publication.
# The setting is now written here, where pnpm reads it, and PROVEN below rather
# than assumed. Keep MIN_RELEASE_AGE in step with pnpm-workspace.yaml's
# `minimumReleaseAge`; scripts/check-release-age-policy.sh fails CI if they drift.
#
# THE PROBE IS NOT CEREMONIAL — it already discriminates between pnpm versions.
# Measured 2026-08-06 with this exact script:
#
#   pnpm 10.33.0 (what the Dockerfile pins)  probe refuses  -> quarantine IS in force
#   pnpm 11.20.0                             probe passes   -> setting silently IGNORED
#
# So pnpm 11 drops `minimum-release-age` from the home .npmrc for global installs,
# exactly as it dropped `only-built-dependencies[]=` (see the PNPM_VERSION comment
# in the Dockerfile). Anyone bumping pnpm past 10.x gets a failed build here
# instead of an image that quietly installs same-day releases again.
set -eu

MANIFEST="${1:-/tmp/cli-tools.json}"

# The config directory pnpm resolves for a global install. /root in the image
# (this runs as root, before `USER node`). Overridable ONLY so the probe logic
# below can be exercised outside a container — set it together with HOME, since
# pnpm looks for $HOME/.npmrc.
NPMRC_DIR="${NPMRC_DIR:-/root}"
NPMRC="$NPMRC_DIR/.npmrc"

# Minutes. Mirrors pnpm-workspace.yaml `minimumReleaseAge: 4320` (three days).
MIN_RELEASE_AGE=4320
# ~190 years — used only by the probe, so its outcome depends on whether the
# setting is READ, never on the real age of any package.
PROBE_AGE=99999999
PROBE_LOG="${TMPDIR:-/tmp}/release-age-probe.log"

specs() {
  node -e 'require(process.argv[1]).forEach((t) => console.log(t.name + "@" + t.version))' "$MANIFEST"
}

# ---- prove the quarantine is in force, not merely configured ----------------
# F01 was a policy that looked configured and was not, so writing the setting is
# not evidence that it applies. Make pnpm demonstrate it: with an absurd age in
# the very file this install path reads, resolving a package we already pin MUST
# be refused. If it succeeds, pnpm is not reading the setting from here and the
# image would ship an unquarantined install path — fail the build rather than
# bake in a second silent policy.
#
# Refusal happens at resolution, so nothing is downloaded and no new package
# enters the trust surface.
probe_spec=$(specs | head -n 1)
if [ -n "$probe_spec" ]; then
  printf 'minimum-release-age=%s\n' "$PROBE_AGE" > "$NPMRC"
  if pnpm install -g "$probe_spec" > "$PROBE_LOG" 2>&1; then
    echo "FATAL: pnpm ignored minimum-release-age in $NPMRC — the quarantine is NOT" >&2
    echo "       in force for in-image global installs. Find where this pnpm reads the" >&2
    echo "       setting and write it there; do not ship an unprotected install path." >&2
    exit 1
  fi
  if ! grep -q 'ERR_PNPM_NO_MATURE_MATCHING_VERSION' "$PROBE_LOG"; then
    echo "FATAL: the release-age probe failed for some reason OTHER than the age gate," >&2
    echo "       so the quarantine cannot be confirmed. Not proceeding." >&2
    cat "$PROBE_LOG" >&2
    exit 1
  fi
  rm -f "$PROBE_LOG"
  echo "release-age quarantine verified in force for global installs (${MIN_RELEASE_AGE} minutes)"
fi

# Write the real config: the release-age floor, plus the per-tool
# only-built-dependencies opt-ins pnpm reads at install time (it skips build
# scripts by default; a tool with a native postinstall sets "onlyBuilt": true).
node -e '
  const [manifestPath, minAge] = process.argv.slice(1);  // argv[3] = npmrc path
  const tools = require(manifestPath);
  const lines = ["minimum-release-age=" + minAge];
  for (const t of tools) if (t.onlyBuilt) lines.push("only-built-dependencies[]=" + t.name);
  require("fs").writeFileSync(process.argv[3], lines.join("\n") + "\n");
' "$MANIFEST" "$MIN_RELEASE_AGE" "$NPMRC"

# Install every tool, pinned. name@version specs never contain spaces, so the
# unquoted expansion word-splits cleanly into positional args.
#
# A tool pinned to a version younger than MIN_RELEASE_AGE now fails the build
# with ERR_PNPM_NO_MATURE_MATCHING_VERSION. That is the quarantine working: pin
# a version that has already matured rather than the newest tag.
# shellcheck disable=SC2046
set -- $(specs)
if [ "$#" -gt 0 ]; then
  pnpm install -g "$@"
fi
