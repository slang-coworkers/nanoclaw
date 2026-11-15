#!/usr/bin/env bash
# Check that a session container cannot reach the OneCLI management API.
#
# The model rule (docs/session-privilege.md) holds only when a session cannot change the gateway's
# rules or read another agent's access token, and the management API can do both. The API must listen
# on the loopback address of the host, not on the docker bridge. This script starts a throwaway container
# on the network that sessions use and tries to reach the API from there.
#
# Usage:  scripts/check-onecli-api-unreachable.sh [IMAGE] [NETWORK]
#   IMAGE    a nanoclaw agent image with curl (default: the first nanoclaw-agent-v2 image)
#   NETWORK  the docker network that sessions run on (default: bridge)
# Environment:
#   ONECLI_API_PORT  the host port of the API (default: the port of ONECLI_URL in .env, else 10256)
#   CHECK_URLS       extra URLs to try, separated by spaces
#   CHECK_PORTS      extra host:port pairs to try with a plain TCP connect, separated by spaces
#
# Prints one line per attempt, then UNREACHABLE (exit 0) or REACHABLE (exit 1). No secret is read:
# the attempts are health requests and TCP connects.
set -u

IMAGE=${1:-$(docker images --format '{{.Repository}}:{{.Tag}}' | grep '^nanoclaw-agent-v2' | head -1)}
NET=${2:-bridge}
[ -n "$IMAGE" ] || { echo "no agent image found; pass one as the first argument" >&2; exit 2; }

PORT=${ONECLI_API_PORT:-}
if [ -z "$PORT" ] && [ -f .env ]; then
  PORT=$(sed -n 's#^ONECLI_URL=.*:\([0-9][0-9]*\)/\{0,1\}$#\1#p' .env | head -1)
fi
PORT=${PORT:-10256}
GW=$(docker network inspect "$NET" --format '{{range .IPAM.Config}}{{.Gateway}} {{end}}' 2>/dev/null | awk '{print $1}')

# Port 10254 is where the API listens inside the gateway container. A session reaches it there when the
# gateway is attached to the session network, as with egress lockdown.
urls="http://host.docker.internal:$PORT/v1/health ${GW:+http://$GW:$PORT/v1/health} http://host.docker.internal:10254/v1/health ${CHECK_URLS:-}"
reached=0

# probe <label> <shell command run in the container that prints a code or a word>
probe() {
  out=$(docker run --rm --network "$NET" --add-host host.docker.internal:host-gateway --entrypoint sh "$IMAGE" -c "$2" 2>/dev/null)
  case "$out" in
    ''|000*|closed|*curl-failed) echo "  closed   $1" ;;
    *) echo "  REACHED  $1 ($out)"; reached=1 ;;
  esac
}

echo "image $IMAGE, network $NET"
for url in $urls; do
  probe "$url" "curl -s -m 5 -o /dev/null -w '%{http_code}' '$url' || echo curl-failed"
done
for hp in ${CHECK_PORTS:-}; do
  host=${hp%:*}; port=${hp##*:}
  probe "tcp $hp" "timeout 3 bash -c '</dev/tcp/$host/$port' 2>/dev/null && echo open || echo closed"
done

if [ "$reached" = 1 ]; then
  echo "REACHABLE: a session container can reach the OneCLI management API. Bind it to 127.0.0.1." >&2
  echo REACHABLE
  exit 1
fi
echo UNREACHABLE
