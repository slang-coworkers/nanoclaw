#!/bin/bash
# Copy the agent image into the engine that runs agent containers, when that is
# not the engine that built it.
#
#   container/sync-agent-runtime.sh <image:tag>
#
# NANOCLAW_AGENT_DOCKER_HOST (the environment wins, then .env) names the agent
# engine's Docker-compatible API, e.g. unix:///run/podman/podman.sock on hosts
# whose agents run under podman with slirp4netns while images are built with
# Docker/BuildKit. Unset — the default — this is a no-op.
#
# The copy is checked by layer content (RootFS diff IDs), which both engines
# report identically; image IDs differ between Docker's containerd store and
# podman, so they cannot be compared.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="${NANOCLAW_ENV_FILE:-$PROJECT_ROOT/.env}"
RUNTIME="${CONTAINER_RUNTIME:-docker}"
IMAGE="${1:?usage: container/sync-agent-runtime.sh <image:tag>}"

AGENT_HOST="${NANOCLAW_AGENT_DOCKER_HOST:-}"
if [ -z "$AGENT_HOST" ] && [ -f "$ENV_FILE" ]; then
  AGENT_HOST="$(grep '^NANOCLAW_AGENT_DOCKER_HOST=' "$ENV_FILE" | tail -n1 | cut -d= -f2- | tr -d '"' | tr -d "'" | tr -d '[:space:]' || true)"
fi
[ -n "$AGENT_HOST" ] || exit 0
[ "$AGENT_HOST" != "${DOCKER_HOST:-}" ] || exit 0

build_layers() { "$RUNTIME" image inspect --format '{{json .RootFS.Layers}}' "$IMAGE"; }
agent() { DOCKER_HOST="$AGENT_HOST" "$RUNTIME" "$@"; }
agent_layers() { agent image inspect --format '{{json .RootFS.Layers}}' "$IMAGE" 2>/dev/null || true; }

want="$(build_layers)" || { echo "No local image $IMAGE to copy to the agent runtime" >&2; exit 1; }
if [ "$(agent_layers)" = "$want" ]; then
  echo "Agent runtime already has $IMAGE"
  exit 0
fi

echo "Copying $IMAGE to the agent runtime ($AGENT_HOST)..."
out="$("$RUNTIME" save "$IMAGE" | agent load 2>&1)" || { echo "$out" >&2; exit 1; }
# podman names an OCI-layout load after the archive's ref annotation
# ("localhost/latest:latest" for a :latest tag), not the tag that was saved.
loaded="$(printf '%s\n' "$out" | sed -n 's/^Loaded image[^:]*: //p' | tail -n1 | cut -d, -f1)"
[ -n "$loaded" ] || { echo "Could not read the loaded image name from: $out" >&2; exit 1; }
if [ "$loaded" != "$IMAGE" ]; then
  agent tag "$loaded" "$IMAGE"
  agent rmi "$loaded" >/dev/null 2>&1 || true
fi

[ "$(agent_layers)" = "$want" ] || { echo "Agent runtime resolves $IMAGE to different layers than the build" >&2; exit 1; }
echo "Agent runtime has $IMAGE"
