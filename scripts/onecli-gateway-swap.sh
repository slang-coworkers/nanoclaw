#!/usr/bin/env bash
# Put a OneCLI gateway image live, bind its management API to loopback, point nanoclaw at it, and roll it back.
#
# Usage:
#   scripts/onecli-gateway-swap.sh swap <image>        for example onecli-cost:v5
#   scripts/onecli-gateway-swap.sh rollback <stamp>    the stamp that `swap` printed
#
# `swap` backs up the compose file and the nanoclaw .env under one stamp, sets the image of the gateway
# service, rewrites every host binding of container port 10254 (the management API) to 127.0.0.1, starts
# the gateway, waits until it is healthy, sets ONECLI_URL in .env to the loopback address, and restarts the
# nanoclaw services. If the gateway is not healthy it restores the compose file by itself and stops.
# `rollback` restores both files from the stamp and starts the old gateway again.
#
# Environment (the defaults fit a prod-style install):
#   ONECLI_COMPOSE_DIR  directory of the OneCLI docker-compose.yml        (default ~/.onecli)
#   ONECLI_SERVICE      compose service name of the gateway                (default onecli)
#   ONECLI_CONTAINER    its container name                                 (default: the service name)
#   NANOCLAW_DIR        the nanoclaw checkout that holds .env              (default: the current directory)
#   NANOCLAW_SERVICES   systemd user units to restart, space separated     (default "nanoclaw nanoclaw-dashboard")
#
# It prints image and port lines only, never an environment value.
set -u

MODE=${1:-}
ARG=${2:-}
DIR=${ONECLI_COMPOSE_DIR:-$HOME/.onecli}
SERVICE=${ONECLI_SERVICE:-onecli}
CONTAINER=${ONECLI_CONTAINER:-$SERVICE}
NC_DIR=${NANOCLAW_DIR:-$PWD}
UNITS=${NANOCLAW_SERVICES:-nanoclaw nanoclaw-dashboard}
COMPOSE=$DIR/docker-compose.yml
ENVFILE=$NC_DIR/.env
export XDG_RUNTIME_DIR=${XDG_RUNTIME_DIR:-/run/user/$(id -u)}

die() { echo "ERROR: $*" >&2; exit 1; }
[ -f "$COMPOSE" ] || die "no compose file at $COMPOSE"
[ -f "$ENVFILE" ] || die "no .env at $ENVFILE"

# healthy <container>: the container reports healthy, or runs when it has no health check.
healthy() {
  local st
  for _ in $(seq 1 40); do
    st=$(docker inspect "$1" --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' 2>/dev/null)
    case "$st" in healthy|running) return 0 ;; esac
    sleep 3
  done
  return 1
}

restart_units() {
  for u in $UNITS; do systemctl --user restart "$u" || echo "WARNING: could not restart $u"; done
  sleep 8
  for u in $UNITS; do echo "  $u: $(systemctl --user is-active "$u")"; done
}

# edit_compose <image>: set the image of the service and bind container port 10254 to 127.0.0.1.
# Prints the API host port.
edit_compose() {
  python3 - "$COMPOSE" "$SERVICE" "$1" <<'PY'
import re, sys
path, service, image = sys.argv[1:4]
lines = open(path).read().split("\n")
out, in_service, port, image_done = [], False, None, False
for line in lines:
    m = re.match(r"^(\s*)([A-Za-z0-9_.-]+):\s*$", line)
    if m and len(m.group(1)) == 0:
        in_service = False
    elif m and len(m.group(1)) == 2:
        in_service = m.group(2) == service
    if in_service and re.match(r"^\s+image:", line):
        line = re.sub(r"(image:\s*)\S+", r"\g<1>" + image, line)
        image_done = True
    if in_service and ":10254" in line:
        if "127.0.0.1:" not in line:
            line = re.sub(r"(?:0\.0\.0\.0:)?(\d{2,5}):10254", r"127.0.0.1:\1:10254", line)
        found = re.search(r"127\.0\.0\.1:(\d{2,5}):10254", line)
        if not found:
            sys.exit("could not bind the management API in: " + line.strip())
        port = found.group(1)
    out.append(line)
if not image_done:
    sys.exit("no image line in service " + service)
if port is None:
    sys.exit("service %s publishes no port mapped to 10254 (the management API)" % service)
open(path, "w").write("\n".join(out))
print(port)
PY
}

case "$MODE" in
  swap)
    IMAGE=$ARG
    [ -n "$IMAGE" ] || die "usage: $0 swap <image>"
    [ -n "$(docker images -q "$IMAGE")" ] || die "image $IMAGE does not exist on this host"
    STAMP=$(date +%Y%m%d-%H%M%S)
    cp -p "$COMPOSE" "$COMPOSE.bak-pre-swap-$STAMP" || die "backup failed"
    cp -p "$ENVFILE" "$ENVFILE.bak-pre-bind-$STAMP" || die "backup failed"
    PORT=$(edit_compose "$IMAGE") || { cp -p "$COMPOSE.bak-pre-swap-$STAMP" "$COMPOSE"; die "could not edit the compose file; it is restored"; }
    echo "compose lines now:"; grep -n "image:\|:10254" "$COMPOSE" | grep -v "DATABASE_URL" | sed 's/^/  /'
    (cd "$DIR" && docker compose up -d "$SERVICE") 2>&1 | tail -3
    if ! healthy "$CONTAINER" || [ "$(curl -s -o /dev/null -w '%{http_code}' -m 10 "http://127.0.0.1:$PORT/v1/health")" != 200 ]; then
      echo "gateway is not healthy: rolling back the compose file"
      cp -p "$COMPOSE.bak-pre-swap-$STAMP" "$COMPOSE"
      (cd "$DIR" && docker compose up -d "$SERVICE") 2>&1 | tail -2
      die "swap failed; the old gateway is running again. Stamp $STAMP"
    fi
    echo "gateway healthy; API answers 200 on 127.0.0.1:$PORT"
    if grep -q '^ONECLI_URL=' "$ENVFILE"; then
      sed -i "s#^ONECLI_URL=.*#ONECLI_URL=http://127.0.0.1:$PORT#" "$ENVFILE"
      echo "ONECLI_URL now points at 127.0.0.1:$PORT"
    else
      echo "WARNING: no ONECLI_URL in $ENVFILE; nanoclaw uses its default address"
    fi
    restart_units
    echo "stamp: $STAMP   (rollback: $0 rollback $STAMP)"
    echo SWAP-DONE
    ;;
  rollback)
    STAMP=$ARG
    [ -n "$STAMP" ] || die "usage: $0 rollback <stamp>"
    [ -f "$COMPOSE.bak-pre-swap-$STAMP" ] || die "no compose backup for stamp $STAMP"
    [ -f "$ENVFILE.bak-pre-bind-$STAMP" ] || die "no .env backup for stamp $STAMP"
    cp -p "$COMPOSE.bak-pre-swap-$STAMP" "$COMPOSE"
    cp -p "$ENVFILE.bak-pre-bind-$STAMP" "$ENVFILE"
    (cd "$DIR" && docker compose up -d "$SERVICE") 2>&1 | tail -2
    healthy "$CONTAINER" && echo "old gateway healthy" || echo "WARNING: old gateway is not healthy yet"
    restart_units
    docker ps --filter "name=$CONTAINER" --format '  {{.Names}} {{.Image}} {{.Status}}'
    echo ROLLBACK-DONE
    ;;
  *)
    sed -n '2,25p' "$0" | sed 's/^# \{0,1\}//'
    exit 2
    ;;
esac
