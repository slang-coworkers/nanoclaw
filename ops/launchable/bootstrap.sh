#!/bin/bash
# =============================================================================
# bootstrap.sh — Brev Launchable VM-Mode SETUP SCRIPT for slang-coworkers-prod.
# HALF A (environment + config) of a MIGRATION. No secrets, no state, no fresh
# wizard. Public repo (no token). Half B = restore-state.sh + repoint.md.
#
# Reproduces the host from a git clone: disks + /ephemeral bind, docker + GPU
# config (docker left STOPPED — Half B rsyncs the graph then starts it), host
# toolchain, repo reconstructed from origin/nv-coworkers + setup.sh + optional
# mounts, cron, systemd prereqs. Overlays (nv-slang/nv-slangpy) are composed in Half B. NO corpnet.
#
# Test:    brev create test --type L40S --startup-script @bootstrap.sh
# Publish: Brev Console -> Launchable -> VM Mode. (16 KiB field limit: paste bootstrap.min.sh.)
# =============================================================================
set -euo pipefail

# ---- params (override via env / Brev launch parameters) ---------------------
: "${NC_USER:=ubuntu}"
: "${HOME_DIR:=/home/${NC_USER}}"
: "${REPO_DIR:=${HOME_DIR}/slang-coworkers-prod/nanoclaw}"   # slug=sha1(REPO_DIR)[:8]; keep identical to prod (41b9e3fd)
: "${REPO_URL:=https://github.com/slang-coworkers/nanoclaw.git}"
: "${REPO_BRANCH:=nv-coworkers}"
: "${BIG_DISK:=}"            # block device that becomes /data (e.g. /dev/vdb). Empty = /data is a dir on root (single-disk ok).
: "${FORMAT_BIG_DISK:=0}"    # 1 = mkfs.ext4 the big disk (DATA LOSS). Leave 0; restore rsyncs into /data.
: "${MIN_DATA_FREE_GB:=800}" # /data must have >= this free (payload ~750G + regrowth). Half B re-runs with 0.
: "${ENABLE_GPU:=1}"         # a REQUEST — auto-degrades to 0 if no usable GPU is present (Layer 0).
: "${BUN_VERSION:=1.3.14}"
: "${UV_VERSION:=0.11.29}"
: "${GH_VERSION:=2.96.0}"
export XDG_RUNTIME_DIR="/run/user/$(id -u)"
export DEBIAN_FRONTEND=noninteractive

log(){ echo; echo "===== $* ====="; }
have(){ command -v "$1" >/dev/null 2>&1; }
die(){ echo "FATAL: $*" >&2; exit 1; }
is_int(){ [[ "${1:-}" =~ ^[0-9]+$ ]]; }
SLUG=""

# Brev runs the VM setup script as the default user. If ever invoked as root,
# re-exec as ${NC_USER} (forwarding launch-param env) so the systemd --user +
# non-root docker-group model holds. NC_REEXEC guards the loop; needs $0 to be a file.
if [ "$(id -u)" -eq 0 ] && [ "${NC_REEXEC:-}" != 1 ]; then
  id -u "$NC_USER" >/dev/null 2>&1 || die "running as root and user '${NC_USER}' does not exist"
  [ -r "$0" ] || die "running as root but \$0='$0' is not re-executable — configure the setup script to run as ${NC_USER}"
  echo "running as root — re-exec as ${NC_USER}"
  exec sudo -H -u "$NC_USER" env NC_REEXEC=1 \
    NC_USER="$NC_USER" HOME_DIR="$HOME_DIR" REPO_DIR="$REPO_DIR" REPO_URL="$REPO_URL" REPO_BRANCH="$REPO_BRANCH" \
    BIG_DISK="${BIG_DISK:-}" FORMAT_BIG_DISK="$FORMAT_BIG_DISK" \
    MIN_DATA_FREE_GB="$MIN_DATA_FREE_GB" ENABLE_GPU="$ENABLE_GPU" \
    BUN_VERSION="$BUN_VERSION" UV_VERSION="$UV_VERSION" GH_VERSION="$GH_VERSION" \
    bash "$0" "$@"
fi

# ---- Layer 0: preflight -----------------------------------------------------
log "Layer 0: preflight"
[ "$(id -u)" -ne 0 ] || die "run as ${NC_USER}, not root"
[ "$(id -un)" = "$NC_USER" ] || die "must run as ${NC_USER} (running as $(id -un))"
sudo -n true 2>/dev/null || die "passwordless sudo required"
is_int "$MIN_DATA_FREE_GB" || die "MIN_DATA_FREE_GB must be an integer (got '$MIN_DATA_FREE_GB')"
case "$REPO_DIR" in *[!A-Za-z0-9._/-]*) die "REPO_DIR has shell-unsafe chars";; esac
# GPU auto-degrade: ENABLE_GPU=1 is a request; degrade to CPU on a GPU-less box instead of dying.
if [ "$ENABLE_GPU" = "1" ] && ! { command -v nvidia-smi >/dev/null 2>&1 && nvidia-smi -L >/dev/null 2>&1; }; then
  echo "WARN: ENABLE_GPU=1 but no usable NVIDIA GPU detected — degrading to CPU mode (ENABLE_GPU=0)."
  ENABLE_GPU=0
fi

# ---- Layer 1: disks + /ephemeral bind (config only; docker started in Half B) ----
# prod fstab: `/dev/vdb /data ext4` + `/data /ephemeral none bind`. Recreate the bind.
log "Layer 1: disks + /ephemeral bind"
sudo mkdir -p /data /ephemeral
BADDATA="$(awk '!/^[[:space:]]*#/ && $2=="/data"{print}' /etc/fstab || true)"
if [ -n "$BIG_DISK" ]; then
  [ -b "$BIG_DISK" ] || die "BIG_DISK=$BIG_DISK is not a block device"
  DTYPE="$(sudo blkid -s TYPE -o value "$BIG_DISK" 2>/dev/null || true)"
  if [ -z "$DTYPE" ]; then
    [ "$FORMAT_BIG_DISK" = "1" ] && sudo mkfs.ext4 -F "$BIG_DISK" || die "$BIG_DISK unformatted; set FORMAT_BIG_DISK=1"
  elif [ "$DTYPE" != "ext4" ]; then
    die "$BIG_DISK already holds filesystem '$DTYPE'"
  fi
  CONFLICT="$(printf '%s\n' "$BADDATA" | grep -vE "^${BIG_DISK}[[:space:]]" | grep -v '^$' || true)"
  [ -z "$CONFLICT" ] || die "/etc/fstab maps a different device to /data:\n$CONFLICT"
  grep -qE "^${BIG_DISK}[[:space:]]+/data[[:space:]]" /etc/fstab \
    || echo "${BIG_DISK} /data ext4 defaults 0 2" | sudo tee -a /etc/fstab >/dev/null
else
  [ -z "$BADDATA" ] || die "/etc/fstab maps something to /data but no BIG_DISK given:\n$BADDATA"
  echo "NOTE: single-disk — /data is a directory on the root fs."
fi
BADEPH="$(awk '!/^[[:space:]]*#/ && $2=="/ephemeral" && !($1=="/data" && $4=="bind"){print}' /etc/fstab || true)"
[ -z "$BADEPH" ] || die "/etc/fstab has a non-/data /ephemeral entry:\n$BADEPH"
grep -qE "^/data[[:space:]]+/ephemeral[[:space:]]+none[[:space:]]+bind" /etc/fstab \
  || echo "/data /ephemeral none bind 0 0" | sudo tee -a /etc/fstab >/dev/null
sudo mount -a
mountpoint -q /ephemeral || die "/ephemeral is not a mountpoint (bind failed)"
[ "$(stat -c %d:%i /data)" = "$(stat -c %d:%i /ephemeral)" ] || die "/ephemeral is not a bind of /data (device:inode differ)"
[ -n "$BIG_DISK" ] && { findmnt -no SOURCE /data | grep -qx "$BIG_DISK" || die "/data not mounted from $BIG_DISK"; }
FREE_BYTES=$(df -B1 --output=avail /data | tail -1 | tr -dc '0-9')
is_int "$FREE_BYTES" || die "could not read /data free space"
[ "$FREE_BYTES" -ge "$(( MIN_DATA_FREE_GB * 1073741824 ))" ] \
  || die "/data has $((FREE_BYTES/1073741824))G free (< ${MIN_DATA_FREE_GB}G); migration payload ~750G+"

# ---- Layer 2: system deps (fail hard) ---------------------------------------
log "Layer 2: system deps"
sudo apt-get update -y
sudo apt-get install -y build-essential ca-certificates curl git jq rsync unzip \
  libpam-systemd python3 python3-pip cron
[ "$ENABLE_GPU" = "1" ] && sudo apt-get install -y nvidia-container-toolkit   # GPU only (repo absent on CPU boxes)
sudo systemctl enable --now cron
if ! have docker; then curl -fsSL https://get.docker.com | sh; fi
sudo usermod -aG docker "$NC_USER"                 # idempotent — ensure membership even if docker was preinstalled
getent group docker | grep -qw "$NC_USER" || die "could not add ${NC_USER} to the docker group"

# ---- Layer 3: NVIDIA runtime + docker daemon.json (leave docker STOPPED) -----
# daemon.json (data-root=/data/docker) written while dockerd is stopped so it can
# never create the graph store on the root disk. Half B rsyncs /data/docker then starts.
log "Layer 3: nvidia runtime + docker data-root"
sudo systemctl stop docker.socket docker.service containerd 2>/dev/null || true
if [ "$ENABLE_GPU" = "1" ]; then
  have nvidia-ctk || die "nvidia-container-toolkit missing but ENABLE_GPU=1"
  sudo nvidia-ctk runtime configure --runtime=docker
  sudo nvidia-ctk config --in-place --set nvidia-container-runtime.mode=legacy 2>/dev/null \
    || sudo sed -i 's/^mode = .*/mode = "legacy"/' /etc/nvidia-container-runtime/config.toml
  grep -qE '^[[:space:]]*mode[[:space:]]*=[[:space:]]*"legacy"' /etc/nvidia-container-runtime/config.toml \
    || die "failed to set nvidia-container-runtime mode=legacy"
fi
sudo mkdir -p /etc/docker
if [ "$ENABLE_GPU" = "1" ]; then
  sudo tee /etc/docker/daemon.json >/dev/null <<'JSON'
{
  "data-root": "/data/docker",
  "runtimes": { "nvidia": { "args": [], "path": "nvidia-container-runtime" } }
}
JSON
else
  sudo tee /etc/docker/daemon.json >/dev/null <<'JSON'
{
  "data-root": "/data/docker"
}
JSON
fi
jq -e . /etc/docker/daemon.json >/dev/null || die "daemon.json invalid"
sudo systemctl enable docker
DKV="$(docker --version | grep -oE '[0-9]+' | head -1)"
[ "$DKV" = "27" ] || echo "WARN: docker major is ${DKV}, prod is 27 — overlay2 is forward-compatible (a 27 graph opens under ${DKV} like an in-place upgrade); Half B proceeds. Downgrade to 27 only if the restored graph misbehaves."
for _u in docker.socket docker.service containerd; do
  ! sudo systemctl is-active --quiet "$_u" || die "$_u still active after stop (must be down before the /data graph rsync)"
done
echo "docker configured + confirmed stopped (Half B rsyncs /data/docker then starts it)."

# ---- Layer 4: host toolchain (gh/bun/uv; put on PATH now) -------------------
log "Layer 4: host toolchain"
# Brev images can ship ~/.cache (or ~/.cache/uv) as a dangling symlink -> uv/uvx mkdir fails
# with "File exists (os error 17)". Heal it (only removes a NON-directory at that path).
[ -d "${HOME_DIR}/.cache" ]    || rm -f "${HOME_DIR}/.cache";    mkdir -p "${HOME_DIR}/.cache"
[ -d "${HOME_DIR}/.cache/uv" ] || rm -f "${HOME_DIR}/.cache/uv"; mkdir -p "${HOME_DIR}/.cache/uv"
# Node 22 via apt/nodesource (prod's path) — install it directly so setup.sh's check_node passes
# and it never falls back to `uvx nodeenv` (which fails on the broken cache above).
if ! have node || [ "$(node -v | grep -oE '[0-9]+' | head -1)" -lt 22 ]; then
  # distro nodejs/libnode-dev conflict with the NodeSource deb on jammy — remove first if present.
  # awk (not grep -q) reads ALL input so dpkg never gets SIGPIPE (which pipefail would turn into a silent skip).
  OLDNODE="$(dpkg -l 2>/dev/null | awk '$1=="ii" && $2 ~ /^(nodejs|npm|libnode-dev)$/ {print $2}' | tr '\n' ' ')"
  [ -n "$OLDNODE" ] && sudo apt-get remove -y $OLDNODE || true
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
[ "$(node -v | grep -oE '[0-9]+' | head -1)" -ge 22 ] || die "Node 22 install failed (got: $(node -v 2>&1))"
GH_MIN=2.92; gh_ok=false
if have gh; then gv="$(gh --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)"; awk -v v="$gv" -v m="$GH_MIN" 'BEGIN{split(v,a,".");split(m,b,".");exit !(a[1]>b[1]||(a[1]==b[1]&&a[2]>=b[2]))}' && gh_ok=true; fi
if [ "$gh_ok" != true ]; then
  curl -fsSL "https://github.com/cli/cli/releases/download/v${GH_VERSION}/gh_${GH_VERSION}_linux_amd64.tar.gz" | tar xz -C /tmp
  install -Dm755 "/tmp/gh_${GH_VERSION}_linux_amd64/bin/gh" "${HOME_DIR}/.local/bin/gh"
  sudo ln -sf "${HOME_DIR}/.local/bin/gh" /usr/local/bin/gh
fi
have bun || curl -fsSL https://bun.sh/install | BUN_INSTALL="${HOME_DIR}/.bun" bash -s "bun-v${BUN_VERSION}"
have uv  || curl -LsSf "https://astral.sh/uv/${UV_VERSION}/install.sh" | sh
export PATH="${HOME_DIR}/.local/bin:${HOME_DIR}/.bun/bin:${PATH}"
if ! grep -q '# >>> nanoclaw path >>>' "${HOME_DIR}/.bashrc" 2>/dev/null; then
  printf '\n# >>> nanoclaw path >>>\nexport PATH="$HOME/.local/bin:$HOME/.bun/bin:$PATH"\n# <<< nanoclaw path <<<\n' >> "${HOME_DIR}/.bashrc"
fi
grep -qx 'nodedir=/usr' "${HOME_DIR}/.npmrc" 2>/dev/null || printf 'nodedir=/usr\n' >> "${HOME_DIR}/.npmrc"

# ---- Layer 5: repo reconstruct (public clone; nv-coworkers tip + overlays) ---
# prod's deployed HEAD is a LOCAL merge never pushed, so we COMPOSE from the branch tip:
# setup.sh composes origin/nv-main. Overlays (nv-slang/nv-slangpy) are deferred to Half B (need gh creds).
log "Layer 5: repo reconstruct + build"
if [ ! -d "${REPO_DIR}/.git" ]; then
  git clone -b "$REPO_BRANCH" "$REPO_URL" "$REPO_DIR" || die "clone failed (is the repo public / are git creds set?)"
fi
cd "$REPO_DIR"
git remote set-url origin "$REPO_URL"
git fetch origin "$REPO_BRANCH"
git checkout -q "$REPO_BRANCH"
git reset --hard "origin/${REPO_BRANCH}"
SLUG="$(printf '%s' "$REPO_DIR" | sha1sum | cut -c1-8)"
echo "slug=${SLUG}  ${REPO_BRANCH}@$(git rev-parse --short HEAD)"
[ "$SLUG" = "41b9e3fd" ] || echo "WARN: slug ${SLUG} != prod 41b9e3fd — use the identical REPO_DIR or restored image_tag/CONTAINER_IMAGE won't match."
git config user.email >/dev/null 2>&1 || git config user.email "setup@nanoclaw.local"   # merges need an identity
git config user.name  >/dev/null 2>&1 || git config user.name  "nanoclaw-setup"
bash setup.sh                          # composes origin/nv-main + installs deps
# setup.sh's compose_fork treats a failed nv-main fetch as "not a fork" and returns 0 — verify it actually merged
git fetch origin nv-main || die "cannot fetch origin/nv-main to verify composition"
git merge-base --is-ancestor origin/nv-main HEAD || die "origin/nv-main not composed into HEAD — setup.sh's compose_fork silently skipped."
# project overlays (nv-slang/nv-slangpy) are composed in HALF B — they need a gh-authenticated
# fetch-skills (external coworker skills), which only exists after the config bundle restores creds.
pnpm install --frozen-lockfile
pnpm run build
npm run rebuild:claude

# ---- Layer 6: agent image — imported via /data rsync (Half B) ----------------
log "Layer 6: agent image"
echo "MIGRATION: base + per-group ag-* images ride in via the /data rsync (Half B)."

# ---- Layer 7: mount allowlist (atomic, jq-validated) ------------------------
log "Layer 7: mount allowlist"
MA="${HOME_DIR}/.config/nanoclaw/mount-allowlist.json"; mkdir -p "$(dirname "$MA")"
printf '%s\n' '{"allowedRoots":[{"path":"/ephemeral","allowReadWrite":false}],"blockedPatterns":[],"nonMainReadOnly":true}' > "${MA}.tmp"
jq -e . "${MA}.tmp" >/dev/null || die "mount-allowlist JSON invalid"
mv -f "${MA}.tmp" "$MA"

# ---- Layer 8: PORTS & NETWORK (reference) -----------------------------------
log "Layer 8: ports & network"
echo "network = default docker bridge (containers egress 172.17.0.1 = OneCLI tenant; no host firewall). ports+ingress: see repoint.md."

# ---- Layer 9: cron (managed markers; set -e safe; existence-gated) -----------
log "Layer 9: cron"
declare -a JOBS=()
add_job(){ [ -e "$1" ] && JOBS+=("$2") || echo "  (deferred — missing: $1)"; }
add_job "${REPO_DIR}/scripts/funnel-cron.sh"                       "*/30 * * * * ${REPO_DIR}/scripts/funnel-cron.sh"
add_job "${REPO_DIR}/scripts/refresh-skills-cron.sh"              "37 * * * * ${REPO_DIR}/scripts/refresh-skills-cron.sh"
add_job "${REPO_DIR}/scripts/claude-trace-gc.py"                  "30 4 * * * cd ${REPO_DIR} && /usr/bin/python3 scripts/claude-trace-gc.py --days 7 --max-gb 5 >> ${HOME_DIR}/.config/nanoclaw/claude-trace-gc.log 2>&1"
add_job "${HOME_DIR}/.config/nanoclaw/refresh-gh-tokens.sh"       "*/30 * * * * ${HOME_DIR}/.config/nanoclaw/refresh-gh-tokens.sh >> ${HOME_DIR}/.config/nanoclaw/refresh.log 2>&1"
add_job "${HOME_DIR}/.config/nanoclaw/refresh-transcripts.sh"     "0 */6 * * * ${HOME_DIR}/.config/nanoclaw/refresh-transcripts.sh >> ${HOME_DIR}/.config/nanoclaw/refresh-transcripts.log 2>&1"
add_job "${HOME_DIR}/.config/nanoclaw/refresh-claude-trace-www.sh" "*/15 * * * * ${HOME_DIR}/.config/nanoclaw/refresh-claude-trace-www.sh >> ${HOME_DIR}/.config/nanoclaw/claude-trace-www.log 2>&1"
[ -d "${HOME_DIR}/.local/share/claude-trace-www" ] \
  && JOBS+=("@reboot cd ${HOME_DIR}/.local/share/claude-trace-www && /usr/bin/python3 -m http.server 8081 --bind 0.0.0.0 >> ${HOME_DIR}/.config/nanoclaw/claude-trace-www.log 2>&1") \
  || echo "  (deferred — missing: ~/.local/share/claude-trace-www)"
CB="# >>> nanoclaw-managed >>>"; CE="# <<< nanoclaw-managed <<<"
EXISTING="$(crontab -l 2>/dev/null || true)"
KEPT="$(printf '%s\n' "$EXISTING" | awk -v b="$CB" -v e="$CE" 'BEGIN{s=0} $0==b{s=1;next} $0==e{s=0;next} s==0{print}')"
{ printf '%s\n' "$KEPT"; printf '%s\n' "$CB"; printf 'PATH=%s/.local/bin:/usr/local/bin:/usr/bin:/bin\n' "$HOME_DIR"; [ "${#JOBS[@]}" -gt 0 ] && printf '%s\n' "${JOBS[@]}"; printf '%s\n' "$CE"; } | crontab -
echo "cron: ${#JOBS[@]} job(s) (config-bundle jobs added when Half B re-runs this)"

# ---- Layer 10: systemd prereqs (linger; units + tripwire via Half B) ---------
log "Layer 10: systemd prereqs"
sudo loginctl enable-linger "$NC_USER"
sudo systemctl start "user@$(id -u).service" || die "failed to start user@$(id -u).service (needed for systemd --user in Half B)"
[ -S "/run/user/$(id -u)/bus" ] || die "user session bus /run/user/$(id -u)/bus missing"
echo "MIGRATION: host/dashboard units + tripwire + discord-feedback + gc/funnel timers + cloudflared arrive via the Half-B config bundle."

# ---- Layer 11: postflight (fail hard) ---------------------------------------
log "Layer 11: postflight"
fail=0
chk(){ if eval "$2" >/dev/null 2>&1; then echo "  OK  $1"; else echo "  !!  $1"; fail=1; fi; }
chk "/ephemeral is a mountpoint bound to /data" 'mountpoint -q /ephemeral && [ "$(stat -c %d:%i /data)" = "$(stat -c %d:%i /ephemeral)" ]'
chk "daemon.json data-root=/data/docker" 'grep -q "/data/docker" /etc/docker/daemon.json'
chk "docker service+socket+containerd all stopped" '! sudo systemctl is-active --quiet docker.service && ! sudo systemctl is-active --quiet docker.socket && ! sudo systemctl is-active --quiet containerd'
chk "linger yes + user bus up" '[ "$(loginctl show-user "$NC_USER" -p Linger --value 2>/dev/null)" = yes ] && [ -S "/run/user/$(id -u)/bus" ]'
chk "gh on PATH"  'command -v gh';  chk "pnpm" 'command -v pnpm'
chk "bun on PATH" 'command -v bun'; chk "uv"   'command -v uv'
chk "dist built"  '[ -f dist/claude-composer.js ]'
chk "mount-allowlist valid" 'jq -e . "$MA"'
echo "versions: node=$(node -v 2>/dev/null) pnpm=$(pnpm -v 2>/dev/null) bun=$(bun -v 2>/dev/null) gh=$(gh --version 2>/dev/null|head -1) docker=$(docker --version 2>/dev/null)"
[ "$fail" = 0 ] || die "postflight failed — do NOT proceed to Half B until green"

log "HALF A COMPLETE"
echo "NEXT — Half B: run ops/launchable/restore-state.sh (full cold rsync of data/ + /data, then start), then ops/launchable/repoint.md."
