#!/bin/bash
# Host prep for NVIDIA agent sandbox VMs (Colossus KubeVirt "AI Sandbox" on
# corpnet). setup.sh runs it through setup/host-profile.sh before installing
# Node dependencies; it is idempotent, so every setup re-run passes through it.
#
# What these VMs need that the generic setup flow cannot provide:
#   - packages the image lacks: libpam-systemd (user services), podman and
#     slirp4netns (agent networking), Docker from Ubuntu, build tools
#   - Docker's MTU equal to the NIC's (larger packets stall TLS silently)
#   - podman's Docker-compatible API socket for agent containers: the VM drops
#     forwarded traffic, so Docker bridge networks have no egress, while
#     slirp4netns egresses through userspace as the VM itself
#   - OneCLI self-hosted with host networking and no login, at the version
#     setup pins; setup's gateway step then reuses it rather than running the
#     onecli.sh installer, whose downloads and bridge network fail here
#   - profile.env's settings in .env, read by the image build and the host
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$HERE/../../.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env"
PODMAN_SOCK=/run/podman/podman.sock
ONECLI_URL=http://127.0.0.1:10254
ME="$(id -un)"

say() { echo "[agent-sandbox] $*"; }
die() {
  echo "[agent-sandbox] ERROR: $*" >&2
  exit 1
}

sudo -n true 2>/dev/null || die "passwordless sudo is required (sudo -n true failed)"

# ── Settings ──────────────────────────────────────────────────────────────────
env_get() { [ -f "$ENV_FILE" ] && grep "^$1=" "$ENV_FILE" | tail -n1 | cut -d= -f2- || true; }
touch "$ENV_FILE"
[ ! -s "$ENV_FILE" ] || [ -z "$(tail -c1 "$ENV_FILE")" ] || echo >>"$ENV_FILE"
while IFS='=' read -r key value; do
  case "$key" in '' | '#'*) continue ;; esac
  [ -n "$(env_get "$key")" ] || printf '%s=%s\n' "$key" "$value" >>"$ENV_FILE"
done <"$HERE/profile.env"
GH_MIRROR="$(env_get NANOCLAW_GITHUB_RELEASES_MIRROR)"
HUB_MIRROR="$(env_get NANOCLAW_DOCKERHUB_MIRROR)"
GHCR_MIRROR="$(env_get NANOCLAW_GHCR_MIRROR)"
say "settings in .env (existing values kept)"

# ── Packages ──────────────────────────────────────────────────────────────────
# dbus-user-session: setup checks Docker access from the user manager with
# `systemd-run --user`, which needs a session bus the image does not ship.
pkgs=(build-essential libpam-systemd dbus-user-session podman slirp4netns python3 curl git)
command -v docker >/dev/null 2>&1 || pkgs+=(docker.io)
docker buildx version >/dev/null 2>&1 || pkgs+=(docker-buildx)
docker compose version >/dev/null 2>&1 || pkgs+=(docker-compose-v2)
missing=()
for p in "${pkgs[@]}"; do dpkg -s "$p" >/dev/null 2>&1 || missing+=("$p"); done
if [ ${#missing[@]} -gt 0 ]; then
  say "installing ${missing[*]}"
  sudo -n apt-get update -qq || die "apt-get update failed"
  sudo -n DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "${missing[@]}" || die "apt-get install failed"
fi

# ── Docker: MTU, service, group ───────────────────────────────────────────────
dev="$(ip route show default | awk '{print $5; exit}')"
mtu="$(cat "/sys/class/net/$dev/mtu")"
daemon_json="$(sudo -n cat /etc/docker/daemon.json 2>/dev/null || true)"
current_mtu="$(printf '%s' "$daemon_json" | python3 -c 'import json,sys
raw = sys.stdin.read().strip()
print(json.loads(raw).get("mtu", "") if raw else "")' 2>/dev/null || true)"
if [ "$current_mtu" != "$mtu" ]; then
  printf '%s' "$daemon_json" | python3 -c 'import json,sys
raw = sys.stdin.read().strip()
d = json.loads(raw) if raw else {}
d["mtu"] = int(sys.argv[1])
print(json.dumps(d, indent=2))' "$mtu" | sudo -n tee /etc/docker/daemon.json >/dev/null
  sudo -n systemctl restart docker
  say "Docker MTU set to $mtu (NIC $dev)"
fi
sudo -n systemctl enable --now docker >/dev/null 2>&1
id -nG "$ME" | grep -qw docker || sudo -n usermod -aG docker "$ME"

# ── User services (Teleport sessions register no login session) ──────────────
sudo -n loginctl enable-linger "$ME"
sudo -n systemctl start "user@$(id -u).service" || die "user@$(id -u).service failed to start"
# A user manager that predates dbus-user-session only gets its bus on request.
XDG_RUNTIME_DIR="/run/user/$(id -u)" systemctl --user start dbus.socket 2>/dev/null || true
grep -qs 'XDG_RUNTIME_DIR' "$HOME/.bashrc" || echo 'export XDG_RUNTIME_DIR="/run/user/$(id -u)"' >>"$HOME/.bashrc"

# ── podman API socket for agent containers ───────────────────────────────────
changed=0
put_root_file() {
  [ "$(sudo -n cat "$1" 2>/dev/null || true)" = "$2" ] && return 0
  sudo -n mkdir -p "$(dirname "$1")"
  printf '%s\n' "$2" | sudo -n tee "$1" >/dev/null
  changed=1
}
put_root_file /etc/systemd/system/podman.socket.d/nanoclaw.conf $'[Socket]\nSocketGroup=docker\nSocketMode=0660'
# The docker CLI cannot pass slirp4netns options, so allow host loopback here.
put_root_file /etc/containers/nanoclaw-containers.conf $'[engine]\nnetwork_cmd_options = ["allow_host_loopback=true"]'
put_root_file /etc/systemd/system/podman.service.d/nanoclaw.conf \
  $'[Service]\nEnvironment=CONTAINERS_CONF=/etc/containers/nanoclaw-containers.conf'
sudo -n systemctl enable podman.socket >/dev/null 2>&1
if [ "$changed" = 1 ] || [ ! -S "$PODMAN_SOCK" ]; then
  # Restarting the API drops a running host's event stream, so only on change.
  sudo -n systemctl daemon-reload
  sudo -n systemctl stop podman.service 2>/dev/null || true
  sudo -n systemctl restart podman.socket || die "podman.socket failed to start"
  sleep 2
  say "podman API socket configured"
fi
version="$(sudo -n env DOCKER_HOST="unix://$PODMAN_SOCK" docker version --format '{{.Server.Version}}' 2>/dev/null || true)"
[ -n "$version" ] || die "podman's Docker-compatible API does not answer at $PODMAN_SOCK"
say "agents run under podman $version (slirp4netns)"

# ── OneCLI ────────────────────────────────────────────────────────────────────
pin() { python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))[sys.argv[2]])' "$PROJECT_ROOT/.claude/skills/add-onecli/versions.json" "$1"; }
GW_VERSION="$(pin onecli-gateway)"
CLI_VERSION="$(pin onecli-cli)"

# Pull an image through Artifactory and tag it with its own name, unless present.
seed_image() {
  local ref="$1" src
  sudo -n docker image inspect "$ref" >/dev/null 2>&1 && return 0
  case "$ref" in
    ghcr.io/*) src="$GHCR_MIRROR/${ref#ghcr.io/}" ;;
    */*) src="$HUB_MIRROR/$ref" ;;
    *) src="$HUB_MIRROR/library/$ref" ;;
  esac
  local attempt
  for attempt in 1 2 3; do # Artifactory answers the odd transient auth error
    sudo -n docker pull -q "$src" >/dev/null && break
    [ "$attempt" = 3 ] && die "could not pull $src"
    sleep $((attempt * 5))
  done
  sudo -n docker tag "$src" "$ref"
}

set_kv() { # file key value
  if grep -q "^$2=" "$1" 2>/dev/null; then
    sed -i "s|^$2=.*|$2=$3|" "$1"
  else
    printf '%s=%s\n' "$2" "$3" >>"$1"
  fi
}

# An existing OneCLI (any install method) is kept and moved to the pinned
# version in its own compose project; otherwise install ours under ~/.onecli.
compose_dir="$(sudo -n docker inspect onecli --format '{{index .Config.Labels "com.docker.compose.project.working_dir"}}' 2>/dev/null || true)"
if [ -z "$compose_dir" ]; then
  compose_dir="$HOME/.onecli"
  mkdir -p "$compose_dir"
  cp "$HERE/onecli-compose.yml" "$compose_dir/docker-compose.yml"
  say "installing OneCLI $GW_VERSION in $compose_dir"
fi
touch "$compose_dir/.env"
set_kv "$compose_dir/.env" ONECLI_VERSION "$GW_VERSION"
sed -i '/^NEXTAUTH_SECRET=/d' "$compose_dir/.env"
for image in $(cd "$compose_dir" && sudo -n docker compose config --images); do seed_image "$image"; done
# Up = the health route or the app root answers 200 (health can be auth-gated).
gateway_up() {
  local route
  for route in /api/health /; do
    [ "$(curl -s -o /dev/null -w '%{http_code}' -m 5 "$ONECLI_URL$route" || true)" = 200 ] && return 0
  done
  return 1
}
running="$(sudo -n docker inspect onecli --format '{{.Config.Image}}' 2>/dev/null || true)"
if [ "$running" != "ghcr.io/onecli/onecli:$GW_VERSION" ] || ! gateway_up; then
  out="$(cd "$compose_dir" && sudo -n docker compose up -d 2>&1)" || die "docker compose up failed in $compose_dir: $out"
fi
for _ in $(seq 1 60); do
  gateway_up && break
  sleep 2
done
gateway_up || die "OneCLI is not answering at $ONECLI_URL"
say "OneCLI $GW_VERSION at $ONECLI_URL"

if ! onecli version 2>/dev/null | grep -q "$CLI_VERSION"; then
  tmp="$(mktemp -d)"
  url="${GH_MIRROR:-https://github.com}/onecli/onecli-cli/releases/download/v$CLI_VERSION/onecli_${CLI_VERSION}_linux_$(dpkg --print-architecture).tar.gz"
  curl -fsSL -o "$tmp/cli.tgz" "$url" || die "could not download the OneCLI CLI from $url"
  tar -xzf "$tmp/cli.tgz" -C "$tmp"
  sudo -n install -m 0755 "$tmp/onecli" /usr/local/bin/onecli
  rm -rf "$tmp"
fi
onecli config set api-host "$ONECLI_URL" >/dev/null
# Local mode answers without a login; OAuth mode (NEXTAUTH_SECRET set, no
# provider) answers AUTH_REQUIRED to every call.
onecli agents list 2>/dev/null | grep -q '"data"' \
  || die "the OneCLI CLI cannot use the gateway — if it says AUTH_REQUIRED, remove NEXTAUTH_SECRET from $compose_dir/.env and re-run"
say "OneCLI CLI $CLI_VERSION → $ONECLI_URL; setup's gateway step will reuse this gateway"
