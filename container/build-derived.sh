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

# ---- local image name, matching build.sh's convention ------------------------
IMAGE_NAME="$(node -e '
  const {execSync} = require("child_process");
  try {
    const m = require("./package.json").name || "nanoclaw";
    console.log(process.env.IMAGE_BASE || "");
  } catch { console.log(""); }
' 2>/dev/null)"
if [ -z "$IMAGE_NAME" ]; then
  # Mirror whatever build.sh produced most recently for this checkout.
  IMAGE_NAME="$($RUNTIME images --format '{{.Repository}}' | grep -E '^nanoclaw-agent' | head -1)"
fi
[ -n "$IMAGE_NAME" ] || IMAGE_NAME="nanoclaw-agent"
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
