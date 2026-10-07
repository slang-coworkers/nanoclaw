#!/bin/bash
# Prepare an agent-image build for hosts on restricted networks, and print the
# extra `docker build` arguments that go with it. Shared by container/build.sh
# and setup/container.ts so both build paths behave the same.
#
# Every setting is off by default: with none set this prints nothing, stages
# nothing and pulls nothing.
#
# Settings (the environment wins, then .env):
#   NANOCLAW_EXTRA_CA_DIR            directory of PEM CA certificates (*.crt, *.pem)
#                                    to trust while building — for hosts whose
#                                    outbound HTTPS is re-signed by an inspecting
#                                    proxy. Staged into container/extra-ca/.
#   NANOCLAW_GITHUB_RELEASES_MIRROR  URL that stands in for https://github.com in
#                                    release downloads (gh, uv, bun, prebuilt
#                                    native modules), e.g. an Artifactory GitHub remote
#   NANOCLAW_DOCKERHUB_MIRROR        registry path that proxies Docker Hub, e.g.
#                                    registry.example.com/dockerhub-remote. Base
#                                    images missing locally are pulled through it
#                                    and tagged with the name the Dockerfile uses.
#
# Output: one argument per line on stdout — read lines, never split words.
# Progress goes to stderr. Exits non-zero when a configured setting cannot be
# honored, so a build never silently starts without it.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="${NANOCLAW_ENV_FILE:-$PROJECT_ROOT/.env}"
RUNTIME="${CONTAINER_RUNTIME:-docker}"
STAGE="$SCRIPT_DIR/extra-ca"

setting() {
  local value="${!1:-}"
  if [ -z "$value" ] && [ -f "$ENV_FILE" ]; then
    value="$(grep "^$1=" "$ENV_FILE" | tail -n1 | cut -d= -f2- | tr -d '"' | tr -d "'" | tr -d '[:space:]' || true)"
  fi
  printf '%s' "$value"
}

build_arg() { printf -- '--build-arg\n%s\n' "$1"; }

# ── Extra CA certificates ────────────────────────────────────────────────────
# Clear what an earlier build staged first, so removing the setting takes
# effect on the next build.
mkdir -p "$STAGE"
find "$STAGE" -maxdepth 1 -type f ! -name README.md -delete

CA_DIR="$(setting NANOCLAW_EXTRA_CA_DIR)"
if [ -n "$CA_DIR" ]; then
  [ -d "$CA_DIR" ] || { echo "NANOCLAW_EXTRA_CA_DIR=$CA_DIR is not a directory" >&2; exit 1; }
  count=0
  for cert in "$CA_DIR"/*.crt "$CA_DIR"/*.pem; do
    [ -f "$cert" ] && grep -q 'BEGIN CERTIFICATE' "$cert" || continue
    name="$(basename "$cert")"
    # update-ca-certificates only picks up *.crt.
    cp "$cert" "$STAGE/${name%.*}.crt"
    count=$((count + 1))
  done
  [ "$count" -gt 0 ] || { echo "NANOCLAW_EXTRA_CA_DIR=$CA_DIR holds no PEM certificates" >&2; exit 1; }
  echo "Extra CA certificates: $count from $CA_DIR" >&2
  # Node, pip and uv keep their own CA lists; point them at the system store
  # (which the Dockerfile extends with the staged certs) for the build only.
  build_arg NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt
  build_arg PIP_CERT=/etc/ssl/certs/ca-certificates.crt
  build_arg UV_NATIVE_TLS=true
fi

# ── GitHub release downloads ─────────────────────────────────────────────────
GH_MIRROR="$(setting NANOCLAW_GITHUB_RELEASES_MIRROR)"
if [ -n "$GH_MIRROR" ]; then
  GH_MIRROR="${GH_MIRROR%/}"
  case "$GH_MIRROR" in
    http://* | https://*) ;;
    *) echo "NANOCLAW_GITHUB_RELEASES_MIRROR must be an http(s) URL, got '$GH_MIRROR'" >&2; exit 1 ;;
  esac
  echo "GitHub release downloads via $GH_MIRROR" >&2
  build_arg "GITHUB_RELEASES_MIRROR=$GH_MIRROR"
  build_arg "npm_config_better_sqlite3_binary_host_mirror=$GH_MIRROR/WiseLibs/better-sqlite3/releases/download"
fi

# ── Docker Hub base images ───────────────────────────────────────────────────
HUB_MIRROR="$(setting NANOCLAW_DOCKERHUB_MIRROR)"
if [ -n "$HUB_MIRROR" ]; then
  HUB_MIRROR="${HUB_MIRROR%/}"
  refs="$({
    sed -n 's/^# *syntax=\([^ ]*\).*/\1/p' "$SCRIPT_DIR/Dockerfile"
    awk 'toupper($1) == "FROM" { print $2 }' "$SCRIPT_DIR/Dockerfile"
  } | sort -u)"
  for ref in $refs; do
    case "$ref" in *'$'*) continue ;; esac # templated by a build arg
    if [[ "$ref" == */* ]]; then
      case "${ref%%/*}" in *.* | *:* | localhost) continue ;; esac # another registry
      path="$ref"
    else
      path="library/$ref"
    fi
    "$RUNTIME" image inspect "${ref%@*}" >/dev/null 2>&1 && continue
    echo "Base image $ref via $HUB_MIRROR" >&2
    "$RUNTIME" pull -q "$HUB_MIRROR/$path" >&2 || { echo "Could not pull $HUB_MIRROR/$path" >&2; exit 1; }
    # docker cannot tag a digest reference; BuildKit still resolves name:tag@digest
    # against the local image the tag points at.
    "$RUNTIME" tag "$HUB_MIRROR/$path" "${ref%@*}" >&2
  done
fi
