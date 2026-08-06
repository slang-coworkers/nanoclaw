#!/usr/bin/env bash
# Build the derived agent image: hardened upstream base + this fork's layers.
#
#   ./container/build-derived.sh [tag]
#
# Resolves the base from versions.json (or NANOCLAW_AGENT_IMAGE_REF), computes
# the agent-runner lock sha the same way build.sh does, and stamps it onto the
# result so pull.sh/build.sh accept the image for this checkout.
#
# The base is private; `docker pull` needs the credential helper the NanoClaw
# sign-in installs at ~/.local/bin/docker-credential-nanoclaw. That directory is
# NOT on a non-interactive PATH, so we add it — otherwise docker reports
# "no basic auth credentials", which looks like an auth failure but is a PATH one.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

export PATH="$HOME/.local/bin:$PATH"
RUNTIME="${CONTAINER_RUNTIME:-docker}"
TAG="${1:-latest}"

# ---- resolve the base --------------------------------------------------------
BASE="${NANOCLAW_AGENT_IMAGE_REF:-}"
if [ -z "$BASE" ]; then
  BASE="$(node -e '
    const v = require("./versions.json")["agent-image"];
    if (!v) { console.error("no agent-image pin in versions.json"); process.exit(1); }
    // The pin is a plain ref on this fork; upstream also supports a per-platform map.
    console.log(typeof v === "string" ? v : (v[process.env.PLATFORM || "linux/amd64"] || ""));
  ')"
fi
[ -n "$BASE" ] || { echo "could not resolve a base image" >&2; exit 1; }
echo "base:  $BASE"

# ---- local image name --------------------------------------------------------
# Use the SAME slug helper build.sh uses. The previous version computed nothing
# usable (it read package.json, discarded it, and printed $IMAGE_BASE, which is
# normally unset) and then fell back to `docker images | grep ^nanoclaw-agent |
# head -1`. On a host with more than one install that picks an ARBITRARY
# install's image and stamps THIS checkout's lock sha onto it — silently
# corrupting a neighbouring installation. The slug is per-checkout, so derive it.
# shellcheck source=../setup/lib/install-slug.sh
source "$PROJECT_ROOT/setup/lib/install-slug.sh"
IMAGE_NAME="$(container_image_base)"
[ -n "$IMAGE_NAME" ] || { echo "could not resolve the image base name for this checkout" >&2; exit 1; }
echo "target: ${IMAGE_NAME}:${TAG}"

# ---- lock sha (same computation as build.sh) ---------------------------------
LOCK_FILE="container/agent-runner/bun.lock"
if command -v sha256sum >/dev/null 2>&1; then
  LOCK_SHA="$(sha256sum "$LOCK_FILE" | cut -d' ' -f1)"
else
  LOCK_SHA="$(shasum -a 256 "$LOCK_FILE" | cut -d' ' -f1)"
fi
echo "lock:   $LOCK_SHA"

# ---- the base must already be in the local store -----------------------------
# Deliberately NO `docker pull` here. The NanoClaw credential helper only mints a
# registry credential when NANOCLAW_PULL_NONCE is set, which container/pull.sh
# sets for the pull it runs; anything else is refused with "refusing to mint a
# registry credential outside a NanoClaw pull". So the base is fetched via
# pull.sh first. Its tag step then reports agent-runner lock drift — that is
# expected, and is exactly why this derived image exists; the image itself is
# still in the local store afterwards.
if ! $RUNTIME image inspect "$BASE" >/dev/null 2>&1; then
  {
    echo "base image is not in the local store. Fetch it first:"
    echo "  PATH=\$HOME/.local/bin:\$PATH bash container/pull.sh"
    echo "(its \"lock drift — refusing to tag\" message is expected; the image still lands.)"
  } >&2
  exit 1
fi
echo "base: present in local store"

echo "building derived image…"
DOCKER_BUILDKIT=1 $RUNTIME build \
  -f container/Dockerfile.derived \
  --build-arg "BASE_IMAGE=$BASE" \
  --build-arg "AGENT_RUNNER_LOCK_SHA256=$LOCK_SHA" \
  --build-arg "IMAGE_SOURCE=derived" \
  -t "${IMAGE_NAME}:${TAG}" \
  container

echo
# ---- runtime-parity gate -----------------------------------------------------
# The hardened base strips tools our hooks call. A missing one does NOT announce
# itself: the hook exits 127, hook failures are swallowed, and the only symptom
# is a coworker whose dashboard timeline is empty while it otherwise looks fine.
# That cost us a real debugging session. Fail the BUILD instead, where it is
# loud, rather than discovering it from a silent timeline days later.
#
# claude-trace is deliberately NOT listed: it is uncommitted lego-local wiring,
# not part of a clean-checkout build.
REQUIRED_BINS="jq python3 gh curl git node bun codex ncl"
echo "verifying required binaries…"
MISSING="$($RUNTIME run --rm --entrypoint sh "${IMAGE_NAME}:${TAG}" -c '
  for b in '"$REQUIRED_BINS"'; do command -v "$b" >/dev/null 2>&1 || printf "%s " "$b"; done')"
if [ -n "${MISSING// /}" ]; then
  {
    echo "  MISSING from the image: $MISSING"
    echo "  These are called by container/hooks/*.sh and fail SILENTLY at runtime"
    echo "  (exit 127, swallowed by the non-fatal hook timeout)."
  } >&2
  exit 1
fi
echo "  OK  ($REQUIRED_BINS)"

echo
# Codex hooks must be in the MANAGED layer or they never fire — silently. Same
# failure signature as a missing jq: agent replies normally, dashboard timeline
# is empty, nothing logs a reason. Check the file landed AND is readable by the
# runtime user (it is COPY'd as root into a base that runs as `node`).
echo "verifying managed codex hooks…"
if ! $RUNTIME run --rm --entrypoint sh "${IMAGE_NAME}:${TAG}" -c \
  '[ -r /etc/codex/requirements.toml ] && grep -q "allow_managed_hooks_only" /etc/codex/requirements.toml'; then
  {
    echo "  /etc/codex/requirements.toml is missing or unreadable by the runtime user."
    echo "  Codex hooks would fall back to the user layer, where they are UNTRUSTED"
    echo "  and skipped silently — no dashboard events, no error."
  } >&2
  exit 1
fi
echo "  OK  (/etc/codex/requirements.toml present and readable)"

echo
echo "verifying the stamped label matches this checkout…"
GOT="$($RUNTIME inspect "${IMAGE_NAME}:${TAG}" \
  --format '{{index .Config.Labels "dev.nanoclaw.agent-runner-lock-sha256"}}')"
if [ "$GOT" = "$LOCK_SHA" ]; then
  echo "  OK  $GOT"
else
  echo "  MISMATCH image=$GOT checkout=$LOCK_SHA" >&2
  exit 1
fi
echo "built ${IMAGE_NAME}:${TAG}"
