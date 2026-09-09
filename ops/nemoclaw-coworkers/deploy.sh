#!/usr/bin/env bash
# Deploy the merged nv-hermes to the nemoclaw-coworkers instance on slang-cpu-coworkers.
# Run on the box only (hostname guard). Restarting the host unit kills running coworker containers;
# session state survives in the session DBs and resumes on the next wake.
set -euo pipefail
case $(hostname) in slang-cpu-coworkers*) ;; *) echo "WRONG_HOST=$(hostname)"; exit 1;; esac
cd ~/haaggarwal/nemoclaw-coworkers
TS=$(date -u +%Y%m%dT%H%M%SZ)
LOG=~/haaggarwal/deploy-nemoclaw-$TS.log
exec > >(tee -a "$LOG") 2>&1
echo "== deploy $TS  branch=$(git rev-parse --abbrev-ref HEAD) head=$(git rev-parse --short HEAD)"

echo "== running coworker containers (will be killed by the host restart):"
docker ps --format '{{.Names}} {{.Status}}' | grep -E 'nanoclaw|nemo|hermes' || echo "  none"

echo "== backup central DB"
cp data/v2.db "data/v2.db.bak-$TS"

echo "== fetch"
git fetch -q origin nv-hermes

echo "== local modifications to tracked files (hand-copied skills/spines) → stash (kept, not dropped)"
git status --short | grep -v '^??' || echo "  none"
git stash push -m "deploy-$TS" >/dev/null 2>&1 || true

echo "== merge origin/nv-hermes ($(git rev-parse --short origin/nv-hermes))"
git merge --no-edit origin/nv-hermes

echo "== learnings-wiki vocabulary -> data/shared/.wiki-config.json (the KB root the builder reads)"
mkdir -p data/shared
REPO_CFG=ops/nemoclaw-coworkers/learnings-wiki/wiki-config.json
LIVE_CFG=data/shared/.wiki-config.json
if [ ! -f "$REPO_CFG" ]; then
  # ops/nemoclaw-coworkers is nv-hermes-owned; a merge that does not carry the file yet must not
  # abort the deploy under set -e AFTER the DB backup but BEFORE the build and the restart.
  echo "  $REPO_CFG not in the merged tree; leaving $LIVE_CFG as it is"
elif [ -f "$LIVE_CFG" ] && ! cmp -s "$REPO_CFG" "$LIVE_CFG"; then
  # The fold agent is told to edit the LIVE file when VOCAB repeats, so a difference here is
  # probably agent-added vocabulary. The repo copy still wins, but keep the old one and print the
  # diff: silently deleting a vocabulary row nobody can reconstruct is not an acceptable deploy.
  cp "$LIVE_CFG" "$LIVE_CFG.bak-$TS"
  echo "  live $LIVE_CFG DIFFERS from the repo copy (agent-added vocabulary?) — kept as $LIVE_CFG.bak-$TS"
  diff -u "$LIVE_CFG.bak-$TS" "$REPO_CFG" || true
  cp "$REPO_CFG" "$LIVE_CFG"
else
  cp "$REPO_CFG" "$LIVE_CFG"
fi

echo "== requirements/plan: git is the source of truth; mirror docs/hermes-port into the shared dir the coworkers read"
mkdir -p data/shared/hermes && cp docs/hermes-port/*.md data/shared/hermes/

echo "== autopilot: mirror ops/nemoclaw-coworkers/autopilot into data/shared/hermes/autopilot (config.json kept when present)"
if [ -d ops/nemoclaw-coworkers/autopilot ]; then
  # The core, collector, the supervise gate + prompt (run by the Orchestrator's series from
  # /workspace/shared/hermes/autopilot) and dispatch-cron.sh (run by the host crontab from this mirror).
  # config.json is the human's live knob set (wip, paused, authorize_round) and is never overwritten here.
  # Tests stay in git. The series and the crontab line are created/updated by ops/nemoclaw-coworkers/autopilot/install.sh.
  mkdir -p data/shared/hermes/autopilot
  for f in ops/nemoclaw-coworkers/autopilot/*.py ops/nemoclaw-coworkers/autopilot/*.sh ops/nemoclaw-coworkers/autopilot/*.md; do
    case $(basename "$f") in test_*) continue ;; esac
    if [ -f "$f" ]; then cp "$f" data/shared/hermes/autopilot/; fi
  done
  if [ ! -f data/shared/hermes/autopilot/config.json ]; then cp ops/nemoclaw-coworkers/autopilot/config.json data/shared/hermes/autopilot/; fi
  [ -f data/shared/hermes/autopilot/dispatch-cron.sh ] && chmod +x data/shared/hermes/autopilot/dispatch-cron.sh
  rm -f data/shared/hermes/autopilot/gate-dispatch.sh data/shared/hermes/autopilot/dispatch-tick.md   # retired: the dispatch tick is the host cron
else
  echo "  ops/nemoclaw-coworkers/autopilot not in the merged tree; skipping"
fi

echo "== install + build"
pnpm install --frozen-lockfile
pnpm run build
npm run -s validate:templates            # aborts the deploy (set -e) before any restart if a spine no longer composes
npm run -s rebuild:claude || echo "  rebuild:claude failed (non-fatal; groups recompose at spawn)"

echo "== stamp the upgrade marker (the startup tripwire exits the host when data/upgrade-state.json names another commit)"
pnpm exec tsx scripts/upgrade-state.ts set

echo "== restart host + dashboard units (this instance only — lego and 97ab67ad are other installs on this box)"
HOST_UNIT=nanoclaw-v2-604122f6.service
DASH_UNIT=nanoclaw-v2-604122f6-dashboard.service
systemctl --user cat "$HOST_UNIT" >/dev/null   # fail fast if the unit name is wrong
echo "  host=$HOST_UNIT dashboard=$DASH_UNIT"
systemctl --user restart "$HOST_UNIT"
sleep 8
systemctl --user is-active "$HOST_UNIT"
[ -n "$DASH_UNIT" ] && systemctl --user restart "$DASH_UNIT" && systemctl --user is-active "$DASH_UNIT"

echo "== post-checks"
git log --oneline -1
grep -E '^ANTHROPIC_MODEL' .env || echo "  ANTHROPIC_MODEL not in .env"
./bin/ncl cost-cap get | head -8
./bin/ncl groups list | head -8
tail -5 logs/nanoclaw.error.log || true
echo "== done; log: $LOG"
