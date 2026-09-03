#!/usr/bin/env bash
# =============================================================================
# restore-state.sh — HALF B of the slang-coworkers-prod host move (v3).
# Run ON THE NEW box AFTER bootstrap.sh (Half A) printed SHIP-green.
# Pulls a FULL COLD state copy from the OLD box, then brings services up.
#
# prod docker data-root=/data/docker → the full /data cold rsync carries the
# images AND named volumes (both OneCLI vaults). No pg_dumpall / docker save.
#
# SSH is as ${NC_USER} via an explicit key (-i $SSH_KEY). The /data + data/ copies
# need root on BOTH ends (docker graph, pg _data), so they run `sudo rsync` locally
# with `--rsync-path='sudo -n rsync'` remotely — and because sudo runs ssh AS ROOT,
# the key must be root-readable and authorize ${NC_USER}@OLD. Preflight proves this
# exact transport BEFORE prod is stopped.
#
# SAFETY: DRY_RUN=1 by default (rsync -n, no stops/starts). DRY_RUN=0 to execute.
# =============================================================================
set -euo pipefail

# ---- params -----------------------------------------------------------------
: "${OLD_SSH:?set OLD_SSH=ubuntu@<old-box>}"
: "${SSH_KEY:?set SSH_KEY=/path/to/key (root-readable; authorizes ${NC_USER:-ubuntu}@OLD; sudo rsync runs ssh as root)}"
: "${NC_USER:=ubuntu}"; : "${HOME_DIR:=/home/${NC_USER}}"
: "${REPO_DIR:=${HOME_DIR}/slang-coworkers-prod/nanoclaw}"   # MUST equal OLD path (slug stability)
: "${OLD_REPO:=${REPO_DIR}}"
: "${DATA_DIR:=/data}"; : "${OLD_DATA:=${DATA_DIR}}"
: "${EXPECT_SLUG:=41b9e3fd}"
: "${HOST_UNIT:=nanoclaw.service}"          # prod host unit (from restored bundle), NOT nanoclaw-v2-<slug>
: "${SLUG_UNIT:=nanoclaw-v2-${EXPECT_SLUG}.service}"
: "${MCP_PROXY_PORT:=8808}"
: "${PROMPT_CACHE_1H:=0}"       # 1-hour prompt-cache TTL costs more to WRITE; default OFF in the restored .env (set 1 to keep on)
: "${NANOCLAW_PROJECTS:=dashboard,slang,slangpy}"   # project overlays composed in Half B via merge-train (needs restored gh creds); nv-nanoclaw excluded per prod
: "${DRY_RUN:=1}"
SSH_OPTS=(-o BatchMode=yes -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10)
export XDG_RUNTIME_DIR="/run/user/$(id -u)"

log(){ echo; echo "===== $* ====="; }
die(){ echo "FATAL: $*" >&2; exit 1; }
do_run(){ if [ "$DRY_RUN" = 0 ]; then "$@"; else { printf '  [dry-run]'; printf ' %q' "$@"; echo; }; fi; }
remote(){ ssh -i "$SSH_KEY" "${SSH_OPTS[@]}" "$OLD_SSH" "$@"; }               # read-only probe (always runs)
remote_do(){ do_run ssh -i "$SSH_KEY" "${SSH_OPTS[@]}" "$OLD_SSH" "$@"; }     # mutating remote op
# pull <src> <dst> <sudo:0|1> <delete:0|1> [extra rsync flags...]
pull(){
  local src="$1" dst="$2" usesudo="$3" del="$4"; shift 4
  local -a flags=(-aHAX --numeric-ids --info=progress2)
  [ "$DRY_RUN" = 0 ] || flags+=(-n)
  [ "$del" = 1 ] && flags+=(--delete)
  [ "$#" -gt 0 ] && flags+=("$@")
  local -a pre=(); [ "$usesudo" = 1 ] && { pre=(sudo -n); flags+=("--rsync-path=sudo -n rsync"); }
  do_run "${pre[@]}" rsync "${flags[@]}" -e "ssh -i $SSH_KEY ${SSH_OPTS[*]}" "${OLD_SSH}:${src}" "$dst"
}

# ---- 0. preflight (all BLOCKING; runs BEFORE anything is stopped) -----------
log "0. preflight"
[ "$(id -un)" = "$NC_USER" ] || die "run as ${NC_USER}"
[ -r "$SSH_KEY" ] || die "SSH_KEY $SSH_KEY not readable"
sudo -n test -r "$SSH_KEY" || die "SSH_KEY $SSH_KEY not readable by ROOT (sudo rsync runs ssh as root)"
remote true 2>/dev/null || die "cannot ssh $OLD_SSH with $SSH_KEY"
sudo -n true 2>/dev/null || die "local passwordless sudo required"
remote sudo -n true 2>/dev/null || die "remote passwordless sudo required"
# prove the EXACT privileged transport (sudo→ssh-as-root→remote sudo rsync) before prod is touched
do_run rm -f /tmp/.rtest.$$
sudo -n rsync -n -e "ssh -i $SSH_KEY ${SSH_OPTS[*]}" --rsync-path="sudo -n rsync" "${OLD_SSH}:/etc/hostname" "/tmp/.rtest.$$" 2>/dev/null \
  || die "privileged rsync transport FAILED (sudo→ssh -i $SSH_KEY→remote sudo rsync). Fix before running — do NOT stop prod."
rm -f /tmp/.rtest.$$
# Half A green on THIS box
mountpoint -q /ephemeral && [ "$(stat -c %d:%i /data)" = "$(stat -c %d:%i /ephemeral)" ] || die "/ephemeral bind missing — run bootstrap.sh"
[ -f "${REPO_DIR}/dist/claude-composer.js" ] || die "repo not built — run bootstrap.sh"
grep -q '/data/docker' /etc/docker/daemon.json || die "daemon.json data-root not set — run bootstrap.sh"
# BLOCKING compatibility checks
[ "$(printf '%s' "$REPO_DIR" | sha1sum | cut -c1-8)" = "$EXPECT_SLUG" ] || die "slug != $EXPECT_SLUG (REPO_DIR path differs)"
echo "repo HEAD (reconstructed nv-coworkers tip): $(git -C "$REPO_DIR" rev-parse --short HEAD) — prod's deploy SHA is local-only, not compared; tripwire is re-stamped in step 7"
LDV="$(docker --version | grep -oE '[0-9]+' | head -1)"; RDV="$(remote docker --version | grep -oE '[0-9]+' | head -1)"
[ "$LDV" = "$RDV" ] || echo "WARN: docker major differs (new=$LDV old=$RDV) — overlay2 is backward-compatible (new>=old is safe); if the restored graph misbehaves, downgrade docker to ${RDV}.x on the new box."
# free space for data/ (46G on the small root fs)
SRC_DATA_KB="$(remote sudo -n du -sk "${OLD_REPO}/data" | awk '{print $1}')"
DST_FREE_KB="$(df -Pk "${REPO_DIR}" | tail -1 | awk '{print $4}')"
[ "$DST_FREE_KB" -gt "$(( SRC_DATA_KB + 5*1024*1024 ))" ] || die "root fs ${DST_FREE_KB}K free; data/ ${SRC_DATA_KB}K (+5G) — bigger root needed"
# source must be the REAL populated /data (a specific vault volume must exist there) — guards --delete
remote sudo -n test -d "${OLD_DATA}/docker/volumes/onecli_pgdata" || die "${OLD_DATA}/docker/volumes/onecli_pgdata missing on OLD — wrong OLD_DATA (a --delete against an empty source would ERASE /data)"
remote test -f "${OLD_REPO}/data/v2.db" || die "${OLD_REPO}/data/v2.db missing on OLD — wrong OLD_REPO"
# Capture the OLD user crontab NOW (read-only, before any teardown). /var/spool/cron
# is NOT in the home rsync, so without this every managed job (sprint-triage,
# kb-health, kb-doctor, refresh-gh-tokens, refresh-transcripts + @reboot,
# claude-trace-www, funnel-cron, docker-gc) is silently dropped — as they were on
# the 2026-08 AWS move. Restored in step 5b.
OLD_CRONTAB="$(remote 'crontab -l' 2>/dev/null || true)"
if [ -n "$OLD_CRONTAB" ]; then echo "captured OLD crontab: $(printf '%s\n' "$OLD_CRONTAB" | grep -vcE '^#|^$') entries"; else echo "WARN: OLD crontab empty/unreadable — no managed jobs to restore"; fi
echo "DRY_RUN=${DRY_RUN}"
if [ "$DRY_RUN" = 0 ]; then
  read -r -p "EXECUTE Half B? STOPS prod on OLD (${OLD_SSH}) and MIRRORS state onto this box. Type 'yes': " ok
  [ "$ok" = yes ] || die "aborted"
fi

# ---- 1. quiesce BOTH boxes (services + timers + cron + docker), assert cold --
log "1. stop + assert inactive (OLD + NEW)"
STOP_USER="${HOST_UNIT} nanoclaw-dashboard.service nanoclaw-prod-discord-feedback.service nanoclaw-funnel.timer nanoclaw-docker-gc.timer"
remote_do "export XDG_RUNTIME_DIR=/run/user/\$(id -u); systemctl --user stop ${STOP_USER} 2>/dev/null || true; sudo systemctl stop cron docker.socket docker.service containerd"
do_run bash -c "systemctl --user stop ${STOP_USER} 2>/dev/null || true"
do_run sudo systemctl stop cron docker.socket docker.service containerd
if [ "$DRY_RUN" = 0 ]; then
  for svc in docker.service docker.socket containerd; do
    remote sudo -n systemctl is-active --quiet "$svc" && die "OLD $svc still active"
    sudo systemctl is-active --quiet "$svc" && die "NEW $svc still active"
  done
fi

# ---- 2. mirror data/ (SQLite state, ~46G on root) — sudo + --delete + -x -----
log "2. mirror data/ (SQLite state)"
pull "${OLD_REPO}/data/" "${REPO_DIR}/data/" 1 1 -x

# ---- 3. mirror WHOLE /data (docker graph=images+VAULTS + prod-groups 670G) ---
log "3. mirror /data (docker graph incl vaults + prod-groups — the big one)"
pull "${OLD_DATA}/" "${DATA_DIR}/" 1 1

# ---- 4. config bundle (merge, no --delete) ----------------------------------
log "4. config bundle"
pull "${HOME_DIR}/.config/nanoclaw/"     "${HOME_DIR}/.config/nanoclaw/"     0 0
pull "${HOME_DIR}/.config/systemd/user/" "${HOME_DIR}/.config/systemd/user/" 0 0
pull "${HOME_DIR}/.onecli/"              "${HOME_DIR}/.onecli/"              0 0
pull "${HOME_DIR}/.onecli-sprint/"       "${HOME_DIR}/.onecli-sprint/"       0 0
pull "${OLD_REPO}/.env"                  "${REPO_DIR}/.env"                  0 0
# cost control: force the 1-hour prompt-cache TTL vars in the restored .env to PROMPT_CACHE_1H (default 0=off)
do_run sed -i -E "s/^(ENABLE_PROMPT_CACHING_1H(_BEDROCK)?)=.*/\\1=${PROMPT_CACHE_1H}/" "${REPO_DIR}/.env"
pull "${OLD_REPO}/reports/"              "${REPO_DIR}/reports/"              0 0
pull "${HOME_DIR}/.local/share/claude-trace-www/" "${HOME_DIR}/.local/share/claude-trace-www/" 0 0

# ---- 4b. compose project overlays (deferred from Half A — needs the gh creds just restored) ----
log "4b. compose overlays: ${NANOCLAW_PROJECTS}"
if [ -n "$NANOCLAW_PROJECTS" ]; then
  do_run bash -c "cd '$REPO_DIR' && NANOCLAW_PROJECTS='$NANOCLAW_PROJECTS' pnpm exec tsx setup/index.ts --step project-integrations && pnpm install --frozen-lockfile && pnpm run build && npm run rebuild:claude"
  if [ "$DRY_RUN" = 0 ]; then
    IFS=',' read -ra _P <<< "$NANOCLAW_PROJECTS"
    for _p in "${_P[@]}"; do
      _p="${_p// /}"; [ -z "$_p" ] && continue
      case "$_p" in nv-*) _b="$_p";; *) _b="nv-$_p";; esac
      git -C "$REPO_DIR" merge-base --is-ancestor "origin/$_b" HEAD || die "overlay origin/$_b not composed (project-integrations failed — check gh creds / fetch-skills auth)"
    done
  fi
fi

# ---- 5. re-run bootstrap (cron pickup) — capacity gate disabled (data restored) ----
log "5. re-run bootstrap.sh (FRESH_INSTANCE=0, MIN_DATA_FREE_GB=0 — docker stays stopped)"
do_run env MIN_DATA_FREE_GB=0 bash "$(cd "$(dirname "$0")" && pwd)/bootstrap.sh"

# ---- 5b. restore the user crontab (managed jobs — captured in preflight) ------
# /var/spool/cron is not in the home rsync; without this the managed jobs are
# dropped. Install the OLD crontab verbatim (paths are /home/${NC_USER}/... =
# identical on both boxes given the slug-stable REPO_DIR). Runs AFTER bootstrap so
# any generic cron block bootstrap installs is superseded by the authoritative set.
log "5b. restore user crontab"
if [ "$DRY_RUN" = 0 ]; then
  if [ -n "$OLD_CRONTAB" ]; then
    printf '%s\n' "$OLD_CRONTAB" | crontab - && echo "crontab restored ($(crontab -l 2>/dev/null | grep -vcE '^#|^$') entries)" || echo "WARN: crontab restore failed — install the managed jobs manually"
  else
    echo "WARN: no OLD crontab captured — check sprint-triage/kb-health/kb-doctor/refresh-* by hand"
  fi
else
  printf '  [dry-run] install captured OLD crontab (%s entries)\n' "$(printf '%s\n' "$OLD_CRONTAB" | grep -vcE '^#|^$')"
fi

# ---- 6. start docker; assert graph + 4 vaults; bring up OneCLI (waited) ------
log "6. start docker + OneCLI"
do_run sudo systemctl start docker
if [ "$DRY_RUN" = 0 ]; then
  sleep 3
  sudo docker info 2>/dev/null | grep -q "Docker Root Dir: /data/docker" || die "docker root != /data/docker"
  sudo docker image ls | grep -q nanoclaw-agent || die "agent images missing after /data restore"
  for v in onecli_pgdata onecli_app-data onecli-sprint_pgdata onecli-sprint_app-data; do
    sudo docker volume ls --format '{{.Name}}' | grep -qx "$v" || die "vault volume $v missing after /data restore"
  done
fi
do_run bash -c "cd '${HOME_DIR}/.onecli' && sudo docker compose up -d --wait --wait-timeout 60"
do_run bash -c "cd '${HOME_DIR}/.onecli-sprint' && sudo docker compose up -d --wait --wait-timeout 60"
if [ "$DRY_RUN" = 0 ]; then
  for i in $(seq 1 30); do
    ONECLI_API_HOST=http://172.17.0.1:10254 onecli agents list 2>/dev/null | grep -q . && break
    sleep 2; [ "$i" = 30 ] && die "OneCLI vault empty/unreachable after 60s"
  done
fi

# ---- 7. external skills + tripwire -------------------------------------------
log "7. fetch-skills + upgrade tripwire"
do_run bash -c "cd '$REPO_DIR' && bash scripts/fetch-skills.sh"
do_run bash -c "cd '$REPO_DIR' && pnpm exec tsx scripts/upgrade-state.ts set"

# ---- 8. start RESTORED host unit (not --step service), gate, then the rest ---
log "8. start services"
do_run bash -c "systemctl --user disable --now ${SLUG_UNIT} 2>/dev/null || true"   # ensure NO second host against the same DB
do_run rm -f "${REPO_DIR}/data/.mcp-management-token"                              # require a FRESH token after start
do_run systemctl --user daemon-reload
do_run systemctl --user enable --now "$HOST_UNIT"
if [ "$DRY_RUN" = 0 ]; then
  for i in $(seq 1 45); do
    systemctl --user is-active --quiet "$HOST_UNIT" && [ -s "${REPO_DIR}/data/.mcp-management-token" ] \
      && ss -ltn 2>/dev/null | grep -q ":${MCP_PROXY_PORT}\b" && break
    sleep 2; [ "$i" = 45 ] && die "$HOST_UNIT not active with fresh MCP token + proxy :${MCP_PROXY_PORT} after 90s (check logs/nanoclaw.error.log — upgrade tripwire?)"
  done
fi
do_run systemctl --user enable --now nanoclaw-dashboard.service
do_run systemctl --user enable --now nanoclaw-prod-discord-feedback.service
do_run systemctl --user enable --now nanoclaw-funnel.timer nanoclaw-docker-gc.timer
# claude-trace-www: the @reboot cron entry won't fire until reboot — start it now if present
if [ -d "${HOME_DIR}/.local/share/claude-trace-www" ]; then
  do_run bash -c "setsid nohup python3 -m http.server 8081 --bind 0.0.0.0 --directory '${HOME_DIR}/.local/share/claude-trace-www' >> '${HOME_DIR}/.config/nanoclaw/claude-trace-www.log' 2>&1 &"
fi

if [ "$DRY_RUN" != 0 ]; then log "PREVIEW COMPLETE (DRY_RUN=1) — set DRY_RUN=0 to execute"; exit 0; fi

log "HALF B COMPLETE — NEXT: repoint.md"
cat <<NEXT
Verify parity BEFORE repointing (keep OLD stopped-but-alive as rollback):
  - systemctl --user is-active ${HOST_UNIT}                              -> active
  - sudo docker ps                                                       -> agents + onecli + onecli-sprint + postgres up
  - curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3737/      -> 200
  - ONECLI_API_HOST=http://172.17.0.1:10254 onecli agents list          -> secrets present
  - dashboard coworkers/sessions/tasks counts match OLD
Then do repoint.md (cloudflared hostname -> GitHub App webhook URL + Pomerium allowlists + lego cross-links).
NEXT
