#!/bin/bash
# =============================================================================
# sync-prod.sh — warm/delta + final cutover STATE sync (prod -> launchable box).
# Run ON THE LAUNCHABLE box; PULLS from prod over ssh (as ubuntu, file I/O via sudo).
#
# CODE is NOT synced here — it comes from `git reset --hard origin/nv-coworkers`
# (overlays merged into origin). This copies STATE only:
#   data/ (SQLite DBs + agent memory) · /data/prod-groups (worktrees) ·
#   /data/docker (images + OneCLI vault volumes) · config bundle (.config/nanoclaw, .onecli*, .env)
#
# MODE=warm  (default): prod STAYS UP. Additive delta rsync (re-run any time to catch up);
#            EXCLUDES /data/docker (a live overlay2 copy corrupts). Live DBs copy inconsistent
#            (staged) — the final pass re-copies them cold/consistent.
# MODE=final : the cutover. Stop prod + dockerd (both boxes) -> cold --delete mirror incl
#            /data/docker + vaults -> restore .env/flags -> start OneCLI -> fetch-skills ->
#            stamp tripwire -> start services. Old prod left stopped as rollback. Then repoint.md.
#
# SAFETY: DRY_RUN=1 by default (rsync -n, no stops, no starts). DRY_RUN=0 to execute.
# =============================================================================
set -euo pipefail

# ---- params -----------------------------------------------------------------
: "${OLD_SSH:?set OLD_SSH=ubuntu@<prod>  (prod = brev-2sl8wvgfr)}"
: "${SSH_KEY:?set SSH_KEY=/path/to/key (root-readable; authorizes ${NC_USER:-ubuntu}@prod; sudo rsync runs ssh as root)}"
: "${NC_USER:=ubuntu}"; : "${HOME_DIR:=/home/${NC_USER}}"
: "${REPO_DIR:=${HOME_DIR}/slang-coworkers-prod/nanoclaw}"; : "${OLD_REPO:=${REPO_DIR}}"
: "${DATA_DIR:=/data}"; : "${OLD_DATA:=${DATA_DIR}}"
: "${MODE:=warm}"            # warm | final
: "${DRY_RUN:=1}"            # 1 = preview (rsync -n, no stops/starts)
: "${PROMPT_CACHE_1H:=0}"    # 1-hour prompt-cache TTL costs more to write; default OFF in the restored .env
: "${HOST_UNIT:=nanoclaw.service}"
: "${SLUG_UNIT:=nanoclaw-v2-41b9e3fd.service}"
: "${MCP_PROXY_PORT:=8808}"
SSH_OPTS=(-o BatchMode=yes -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10)
export XDG_RUNTIME_DIR="/run/user/$(id -u)"

log(){ echo; echo "===== $* ====="; }
die(){ echo "FATAL: $*" >&2; exit 1; }
do_run(){ if [ "$DRY_RUN" = 0 ]; then "$@"; else { printf '  [dry-run]'; printf ' %q' "$@"; echo; }; fi; }
remote(){ ssh -i "$SSH_KEY" "${SSH_OPTS[@]}" "$OLD_SSH" "$@"; }               # read-only probe (always runs)
remote_do(){ do_run ssh -i "$SSH_KEY" "${SSH_OPTS[@]}" "$OLD_SSH" "$@"; }     # mutating remote op
# pull <src> <dst> <delete:0|1> [extra rsync flags...]  (always sudo both ends; --partial for resumable deltas)
pull(){
  local src="$1" dst="$2" del="$3"; shift 3
  local -a f=(-aHAX --numeric-ids --partial --info=progress2)
  [ "$DRY_RUN" = 0 ] || f+=(-n)
  [ "$del" = 1 ] && f+=(--delete)
  [ "$#" -gt 0 ] && f+=("$@")
  f+=("--rsync-path=sudo -n rsync")
  # run rsync DIRECTLY (not via do_run) so DRY_RUN=1 actually executes `rsync -n` and validates paths/perms/plan
  [ "$DRY_RUN" = 0 ] && echo "  rsync ${OLD_SSH}:${src} -> ${dst}" || echo "  rsync -n (dry) ${OLD_SSH}:${src} -> ${dst}"
  sudo -n rsync "${f[@]}" -e "ssh -i $SSH_KEY ${SSH_OPTS[*]}" "${OLD_SSH}:${src}" "$dst"
}
# assert_not_active <label> <cmd...>  — <cmd> runs `systemctl is-active` (WITHOUT --quiet) locally or over ssh.
# FAIL-CLOSED, and validates BOTH the exit status and the FULL output (not just a prefix):
#   * a trailing `; printf __RC__$?` captures the probe's real exit — a transport/exec failure (ssh=255,
#     not-found=127/126) or a missing sentinel (probe never completed) DIES; it can't read as "stopped".
#   * EVERY whitespace token of is-active's stdout must be inactive|failed|dead|unknown (unit-not-loaded, which
#     cannot be active). Any 'active'/'activating'/'reloading'/'deactivating'/garbage token, or NO token at
#     all (empty output), DIES. So a concatenated/multi-line line like 'inactive active' cannot slip through.
assert_not_active(){
  local label="$1"; shift
  local -; set -f                              # function-scoped: word-split the state tokens without globbing
  local out rc state seen=0 tok
  out="$("$@" 2>/dev/null; printf '__RC__%s' "$?")" || true   # sentinel carries the probe's exit; printf never fails
  case "$out" in *__RC__*) : ;; *) die "could not verify ${label} (probe did not complete — transport/exec failure); refusing destructive cutover" ;; esac
  rc="${out##*__RC__}"; state="${out%__RC__*}"
  case "$rc" in 255|127|126) die "could not verify ${label} (transport/exec failure rc=${rc}); refusing destructive cutover" ;; esac
  for tok in $state; do
    seen=1
    case "$tok" in
      inactive|failed|dead|unknown) : ;;       # not a live writer
      *) die "${label} reports '${tok}' (not inactive/failed/dead/unknown) — refusing destructive cutover" ;;
    esac
  done
  [ "$seen" = 1 ] || die "could not verify ${label} (no state word — transport/systemctl error); refusing destructive cutover"
}
# has <haystack> <needle>  — substring test with NO pipe (dodges pipefail+SIGPIPE from 'producer | grep -q').
has(){ case "$1" in *"$2"*) return 0;; *) return 1;; esac; }

# ---- preflight (all modes) --------------------------------------------------
log "preflight  (MODE=$MODE  DRY_RUN=$DRY_RUN)"
[ "$MODE" = warm ] || [ "$MODE" = final ] || die "MODE must be warm|final"
[ "$(id -un)" = "$NC_USER" ] || die "run as ${NC_USER}"
[ -r "$SSH_KEY" ] || die "SSH_KEY $SSH_KEY not readable"
sudo -n test -r "$SSH_KEY" || die "SSH_KEY not readable by ROOT (sudo rsync runs ssh as root)"
remote true 2>/dev/null || die "cannot ssh $OLD_SSH with $SSH_KEY"
sudo -n true 2>/dev/null || die "local passwordless sudo required"
remote sudo -n true 2>/dev/null || die "remote passwordless sudo required"
# prove the exact privileged transport BEFORE touching anything
do_run rm -f /tmp/.st.$$
sudo -n rsync -n -e "ssh -i $SSH_KEY ${SSH_OPTS[*]}" --rsync-path="sudo -n rsync" "${OLD_SSH}:/etc/hostname" "/tmp/.st.$$" 2>/dev/null \
  || die "privileged rsync transport FAILED (sudo->ssh -i $SSH_KEY->remote sudo rsync). Fix before running."
rm -f /tmp/.st.$$
# Half A must be present on THIS box (capture each stat explicitly — a both-failed pair must NOT compare equal)
DEV_DATA="$(stat -c %d:%i /data 2>/dev/null || true)"
DEV_EPH="$(stat -c %d:%i /ephemeral 2>/dev/null || true)"
{ mountpoint -q /ephemeral && [ -n "$DEV_DATA" ] && [ "$DEV_DATA" = "$DEV_EPH" ]; } || die "/ephemeral bind missing — run bootstrap.sh"
grep -q '/data/docker' /etc/docker/daemon.json || die "daemon.json data-root not set — run bootstrap.sh"
# free space
# capacity check uses TOTAL disk (not free) — delta re-runs already consumed most free space
SRC_KB="$(remote sudo -n du -sk "$OLD_DATA" "$OLD_REPO/data" | awk '{s+=$1} END{print s}')"
TOTAL_KB="$(df -Pk "$DATA_DIR" | tail -1 | awk '{print $2}')"
[ "$TOTAL_KB" -gt "$(( SRC_KB + 20*1024*1024 ))" ] || die "/data capacity ${TOTAL_KB}K < source ${SRC_KB}K (+20G) — disk too small"
# source-identity guard (so a mistyped OLD_* can never --delete against an empty/wrong source)
remote test -f "${OLD_REPO}/data/v2.db" || die "${OLD_REPO}/data/v2.db missing on prod — wrong OLD_REPO?"
remote sudo -n test -d "${OLD_DATA}/docker/volumes/onecli_pgdata" || die "${OLD_DATA}/docker/volumes/onecli_pgdata missing on prod — wrong OLD_DATA?"
# AUTO-MEMORY guard: agent memory must be FILE-based (copied), not the native store (not copied).
# Flip BOTH on prod before the FINAL copy: .env CLAUDE_CODE_DISABLE_AUTO_MEMORY=1 + settings autoMemoryEnabled:false.
AM_ENV=0; AM_SET=0
remote "grep -q '^CLAUDE_CODE_DISABLE_AUTO_MEMORY=1' '${OLD_REPO}/.env'" 2>/dev/null && AM_ENV=1 || true
# settings-side flag: ONLY a real settings.json under the repo or the groups tree counts — not any doc that
# happens to contain the JSON fragment (find restricts to -name settings.json; grep only inspects those).
AM_SET_HIT="$(remote "sudo -n find -L '${OLD_REPO}' '${OLD_DATA}/prod-groups' -type f -name settings.json -print0 2>/dev/null | xargs -0 -r grep -lE '\"autoMemoryEnabled\"[[:space:]]*:[[:space:]]*false' 2>/dev/null | head -1" 2>/dev/null)" || AM_SET_HIT=""
[ -n "$AM_SET_HIT" ] && AM_SET=1 || true
if [ "$AM_ENV" != 1 ] || [ "$AM_SET" != 1 ]; then
  echo "WARN: auto-memory not fully disabled on prod (env=${AM_ENV} settings=${AM_SET}). Flip BOTH before FINAL, or native-store memory won't copy:"
  echo "      .env: CLAUDE_CODE_DISABLE_AUTO_MEMORY=1   +   group settings.json: autoMemoryEnabled: false"
  if [ "$MODE" = final ] && [ "${FORCE_AUTOMEM:-0}" != 1 ]; then die "auto-memory not disabled on prod — flip both, or FORCE_AUTOMEM=1 to override"; fi
fi

# ---- WARM: additive delta, prod stays UP, no docker graph -------------------
if [ "$MODE" = warm ]; then
  log "WARM delta sync (prod stays UP; re-run any time). /data/docker EXCLUDED (cold-only)."
  pull "${OLD_REPO}/data/"             "${REPO_DIR}/data/"             0 -x   # live DBs staged (inconsistent until FINAL)
  pull "${OLD_DATA}/prod-groups/"      "${DATA_DIR}/prod-groups/"      0      # the 670G bulk — big first pass, fast deltas after
  pull "${HOME_DIR}/.config/nanoclaw/" "${HOME_DIR}/.config/nanoclaw/" 0
  pull "${HOME_DIR}/.onecli/"          "${HOME_DIR}/.onecli/"          0
  pull "${HOME_DIR}/.onecli-sprint/"   "${HOME_DIR}/.onecli-sprint/"   0
  pull "${OLD_REPO}/.env"              "${REPO_DIR}/.env"              0
  pull "${OLD_REPO}/reports/"          "${REPO_DIR}/reports/"          0
  log "WARM done. Re-run to catch deltas. When ready to switch:  MODE=final DRY_RUN=0 ./sync-prod.sh"
  exit 0
fi

# ---- FINAL: cold cutover ----------------------------------------------------
log "FINAL cutover — this STOPS prod"
if [ "$DRY_RUN" = 0 ]; then
  read -r -p "STOP prod (${OLD_SSH}) and do the cold cutover onto this box? type 'yes': " ok
  [ "$ok" = yes ] || die "aborted"
fi
# 1. quiesce BOTH boxes.  `nanoclaw*` glob stops EVERY nanoclaw user unit on each box — the primary host unit
# `nanoclaw.service` (dot, NOT matched by `nanoclaw-*`), the slug-named unit (hash differs per box), and any
# service a timer already triggered — not just a hard-coded list.
STOP_GLOB="'nanoclaw*'"
remote_do "export XDG_RUNTIME_DIR=/run/user/\$(id -u); systemctl --user stop ${STOP_GLOB} 2>/dev/null || true; sudo systemctl stop cron docker.socket docker.service containerd"
do_run bash -c "systemctl --user stop ${STOP_GLOB} 2>/dev/null || true"
do_run sudo systemctl stop cron docker.socket docker.service containerd
if [ "$DRY_RUN" = 0 ]; then
  # COLD BARRIER — every writer on BOTH boxes must be PROVABLY inactive before the destructive rsync.
  # assert_not_active is fail-closed (dies on active/transport-error), so a stop that silently failed, an ssh
  # that couldn't reach the box, or a slug/triggered unit we didn't name by hand can never read as "stopped".
  # A trailing sentinel makes enumeration itself transport-failure-fatal: a swallowed ssh error there can't
  # silently shrink the unit list. FLOOR (always-probed known units) is UNIONed with the live-enumerated set.
  # `set -o pipefail` + `&&` gate the sentinel on the pipeline SUCCEEDING — a failed `systemctl list-units`
  # (user-manager unreachable) yields NO sentinel (the invoked shell lacks the script's pipefail otherwise, and
  # a trailing `; printf` would fire regardless), so a partial/empty list can't be mistaken for "0 units".
  list_user_units(){ "$@" "set -o pipefail; export XDG_RUNTIME_DIR=/run/user/\$(id -u); systemctl --user list-units --all --plain --no-legend 'nanoclaw*' 2>/dev/null | awk '{print \$1}' && printf __ENUM_OK__"; }
  # enumerate: print the nanoclaw unit names; return 3 (no sentinel => enumeration failed) so the caller dies.
  enumerate(){ local raw; raw="$(list_user_units "$@" 2>/dev/null || true)"; case "$raw" in *__ENUM_OK__*) printf '%s' "${raw%__ENUM_OK__*}"; return 0 ;; *) return 3 ;; esac; }
  FLOOR="${HOST_UNIT} nanoclaw-dashboard.service nanoclaw-prod-discord-feedback.service nanoclaw-funnel.timer nanoclaw-docker-gc.timer"
  OLD_UNITS="$(enumerate remote)"  || die "could not enumerate OLD nanoclaw units (transport error); refusing destructive cutover"
  NEW_UNITS="$(enumerate bash -c)" || die "could not enumerate NEW nanoclaw units (transport error); refusing destructive cutover"
  # SOURCE (prod) writers — mutate data/ + prod-groups during the cold copy:
  for u in $FLOOR $OLD_UNITS; do
    assert_not_active "OLD user/$u" remote "export XDG_RUNTIME_DIR=/run/user/\$(id -u); systemctl --user is-active $u"
  done
  for s in cron docker.service docker.socket containerd; do
    assert_not_active "OLD system/$s" remote sudo -n systemctl is-active "$s"
  done
  # DEST (this box) writers — the rsync TARGET; a live writer here races/corrupts the copy:
  for u in $FLOOR $SLUG_UNIT $NEW_UNITS; do
    assert_not_active "NEW user/$u" bash -c "export XDG_RUNTIME_DIR=/run/user/\$(id -u); systemctl --user is-active $u"
  done
  for s in cron docker.service docker.socket containerd; do
    assert_not_active "NEW system/$s" sudo -n systemctl is-active "$s"
  done
fi
# 2. cold --delete mirror (both quiescent now — DBs + graph consistent)
pull "${OLD_REPO}/data/"             "${REPO_DIR}/data/"             1 -x
pull "${OLD_DATA}/prod-groups/"      "${DATA_DIR}/prod-groups/"      1
pull "${OLD_DATA}/docker/"           "${DATA_DIR}/docker/"           1        # images + OneCLI vault volumes (cold)
pull "${HOME_DIR}/.config/nanoclaw/" "${HOME_DIR}/.config/nanoclaw/" 0
pull "${HOME_DIR}/.config/systemd/user/" "${HOME_DIR}/.config/systemd/user/" 0
pull "${HOME_DIR}/.onecli/"          "${HOME_DIR}/.onecli/"          0
pull "${HOME_DIR}/.onecli-sprint/"   "${HOME_DIR}/.onecli-sprint/"   0
pull "${OLD_REPO}/.env"              "${REPO_DIR}/.env"              0
pull "${OLD_REPO}/reports/"          "${REPO_DIR}/reports/"          1
pull "${HOME_DIR}/.local/share/claude-trace-www/" "${HOME_DIR}/.local/share/claude-trace-www/" 0
# 3. .env: cost + auto-memory flags
do_run sed -i -E "s/^(ENABLE_PROMPT_CACHING_1H(_BEDROCK)?)=.*/\\1=${PROMPT_CACHE_1H}/" "${REPO_DIR}/.env"
do_run bash -c "grep -q '^CLAUDE_CODE_DISABLE_AUTO_MEMORY=' '${REPO_DIR}/.env' && sed -i 's/^CLAUDE_CODE_DISABLE_AUTO_MEMORY=.*/CLAUDE_CODE_DISABLE_AUTO_MEMORY=1/' '${REPO_DIR}/.env' || echo 'CLAUDE_CODE_DISABLE_AUTO_MEMORY=1' >> '${REPO_DIR}/.env'"
# 4. start docker; verify graph + all 4 vault volumes
do_run sudo systemctl start docker
if [ "$DRY_RUN" = 0 ]; then
  sleep 3
  # capture-then-match (has(): no 'producer | grep -q' — that SIGPIPEs the producer and, under pipefail, can
  # return non-zero on a real match, firing die falsely). docker info emits a lot, so this trap is live here.
  DINFO="$(sudo -n docker info 2>/dev/null || true)"
  has "$DINFO" "Docker Root Dir: /data/docker" || die "docker root != /data/docker"
  DIMGS="$(sudo -n docker image ls 2>/dev/null || true)"
  has "$DIMGS" "nanoclaw-agent" || die "agent images missing after /data restore"
  DVOLS="$(sudo -n docker volume ls --format '{{.Name}}' 2>/dev/null || true)"
  for v in onecli_pgdata onecli_app-data onecli-sprint_pgdata onecli-sprint_app-data; do
    case $'\n'"$DVOLS"$'\n' in *$'\n'"$v"$'\n'*) : ;; *) die "vault volume $v missing" ;; esac
  done
fi
do_run bash -c "cd '${HOME_DIR}/.onecli' && sudo docker compose up -d --wait --wait-timeout 60"
do_run bash -c "cd '${HOME_DIR}/.onecli-sprint' && sudo docker compose up -d --wait --wait-timeout 60"
if [ "$DRY_RUN" = 0 ]; then
  ONECLI_UP=0
  for ((i=1; i<=30; i++)); do          # arithmetic loop: no dependence on `seq` succeeding
    OLIST="$(ONECLI_API_HOST=http://172.17.0.1:10254 onecli agents list 2>/dev/null || true)"
    [ -n "${OLIST//[[:space:]]/}" ] && { ONECLI_UP=1; break; }
    sleep 2
  done
  [ "$ONECLI_UP" = 1 ] || die "OneCLI vault empty/unreachable after 60s"
fi
# 5. external skills (creds now restored) + tripwire
do_run bash -c "cd '$REPO_DIR' && bash scripts/fetch-skills.sh"
do_run bash -c "cd '$REPO_DIR' && pnpm exec tsx scripts/upgrade-state.ts set"
# 6. start the restored host unit (ensure the slug unit is NOT competing), gate on fresh MCP token, then dashboard
do_run bash -c "systemctl --user disable --now ${SLUG_UNIT} 2>/dev/null || true"
do_run rm -f "${REPO_DIR}/data/.mcp-management-token"
do_run systemctl --user daemon-reload
do_run systemctl --user enable --now "$HOST_UNIT"
if [ "$DRY_RUN" = 0 ]; then
  MCP_UP=0
  for ((i=1; i<=45; i++)); do          # arithmetic loop: no dependence on `seq` succeeding
    SSOUT="$(ss -ltn 2>/dev/null || true)"; PORTUP=0     # capture-then-match: no 'ss | grep -q' pipefail/SIGPIPE
    case "$SSOUT" in *":${MCP_PROXY_PORT}"[[:space:]]*) PORTUP=1 ;; esac   # :port then whitespace (col end) — not :portN / :portX
    if systemctl --user is-active --quiet "$HOST_UNIT" && [ -s "${REPO_DIR}/data/.mcp-management-token" ] && [ "$PORTUP" = 1 ]; then MCP_UP=1; break; fi
    sleep 2
  done
  [ "$MCP_UP" = 1 ] || die "$HOST_UNIT not active with fresh MCP token + proxy :${MCP_PROXY_PORT} after 90s"
fi
do_run systemctl --user enable --now nanoclaw-dashboard.service
do_run systemctl --user enable --now nanoclaw-prod-discord-feedback.service
do_run systemctl --user enable --now nanoclaw-funnel.timer nanoclaw-docker-gc.timer
# 7. restore cron daemon + config-bundle cron jobs (token refresh is load-bearing) + trace-www server
do_run sudo systemctl enable --now cron
if [ "$DRY_RUN" = 0 ]; then
  CB="# >>> nanoclaw-managed >>>"; CE="# <<< nanoclaw-managed <<<"; declare -a JOBS=()
  addj(){ [ -e "$1" ] && JOBS+=("$2") || true; }
  addj "${REPO_DIR}/scripts/funnel-cron.sh"                        "*/30 * * * * ${REPO_DIR}/scripts/funnel-cron.sh"
  addj "${REPO_DIR}/scripts/refresh-skills-cron.sh"               "37 * * * * ${REPO_DIR}/scripts/refresh-skills-cron.sh"
  addj "${REPO_DIR}/scripts/claude-trace-gc.py"                   "30 4 * * * cd ${REPO_DIR} && /usr/bin/python3 scripts/claude-trace-gc.py --days 7 --max-gb 5 >> ${HOME_DIR}/.config/nanoclaw/claude-trace-gc.log 2>&1"
  addj "${HOME_DIR}/.config/nanoclaw/refresh-gh-tokens.sh"        "*/30 * * * * ${HOME_DIR}/.config/nanoclaw/refresh-gh-tokens.sh >> ${HOME_DIR}/.config/nanoclaw/refresh.log 2>&1"
  addj "${HOME_DIR}/.config/nanoclaw/refresh-transcripts.sh"      "0 */6 * * * ${HOME_DIR}/.config/nanoclaw/refresh-transcripts.sh >> ${HOME_DIR}/.config/nanoclaw/refresh-transcripts.log 2>&1"
  addj "${HOME_DIR}/.config/nanoclaw/refresh-claude-trace-www.sh" "*/15 * * * * ${HOME_DIR}/.config/nanoclaw/refresh-claude-trace-www.sh >> ${HOME_DIR}/.config/nanoclaw/claude-trace-www.log 2>&1"
  [ -d "${HOME_DIR}/.local/share/claude-trace-www" ] && JOBS+=("@reboot cd ${HOME_DIR}/.local/share/claude-trace-www && /usr/bin/python3 -m http.server 8081 --bind 0.0.0.0 >> ${HOME_DIR}/.config/nanoclaw/claude-trace-www.log 2>&1") || true
  EX="$(crontab -l 2>/dev/null || true)"; KEPT="$(printf '%s\n' "$EX" | awk -v b="$CB" -v e="$CE" 'BEGIN{s=0}$0==b{s=1;next}$0==e{s=0;next}s==0{print}')"
  { printf '%s\n' "$KEPT"; printf '%s\n' "$CB"; printf 'PATH=%s/.local/bin:/usr/local/bin:/usr/bin:/bin\n' "$HOME_DIR"; [ "${#JOBS[@]}" -gt 0 ] && printf '%s\n' "${JOBS[@]}"; printf '%s\n' "$CE"; } | crontab -
  if [ -d "${HOME_DIR}/.local/share/claude-trace-www" ]; then
    setsid nohup python3 -m http.server 8081 --bind 0.0.0.0 --directory "${HOME_DIR}/.local/share/claude-trace-www" >> "${HOME_DIR}/.config/nanoclaw/claude-trace-www.log" 2>&1 < /dev/null &
    # backgrounding returns before python binds — poll until :8081 is actually serving (WARN, don't die: non-critical)
    TRACE_OK=0
    for ((n=1; n<=10; n++)); do        # arithmetic loop: no dependence on `seq` succeeding
      if curl -sf --max-time 2 -o /dev/null "http://127.0.0.1:8081/" 2>/dev/null; then TRACE_OK=1; break; fi
      LST="$(ss -ltn 2>/dev/null || true)"; case "$LST" in *:8081[[:space:]]*) TRACE_OK=1; break;; esac
      sleep 1
    done
    [ "$TRACE_OK" = 1 ] && echo "  claude-trace-www serving on :8081" \
      || echo "  WARN: claude-trace-www did NOT bind :8081 within ~10s — check ${HOME_DIR}/.config/nanoclaw/claude-trace-www.log"
  fi
fi

if [ "$DRY_RUN" != 0 ]; then log "PREVIEW COMPLETE (DRY_RUN=1) — set DRY_RUN=0 to execute the cutover"; exit 0; fi
log "FINAL CUTOVER COMPLETE — verify parity, then repoint.md. Leave OLD prod stopped as rollback."
cat <<NEXT
Verify:
  - systemctl --user is-active ${HOST_UNIT}            -> active
  - sudo docker ps                                     -> agents + onecli + onecli-sprint + postgres
  - curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3737/  -> 200
  - dashboard coworkers/sessions/tasks match OLD
Then repoint.md (new cloudflared hostname -> GitHub App webhook URL + Pomerium allowlists).
NEXT
