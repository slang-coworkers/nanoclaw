#!/usr/bin/env bash
# cron-run.sh — make a nonzero exit from a scheduled job impossible to miss.
#
# Several producers were changed to exit nonzero on a real problem instead of
# always exiting 0. cron then discards that status: there is no MAILTO on these
# boxes, so a failing job is indistinguishable from a passing one from the
# outside. We made the failures loud and the loudness lands in /dev/null.
#
# This wraps ONE command. On failure it drops a marker file the dashboard can
# see and appends a line to a watched log. On the next success it clears the
# marker, so a recovered job stops shouting — a stuck marker nobody can clear
# becomes noise, and noise is how alerts get ignored.
#
#   scripts/cron-run.sh <job-name> <command> [args...]
#
# Exit status is ALWAYS the wrapped command's. See the note above `exit "$RC"`.
#
# Marker: data/shared/.cron-failures/<job-name>.json — PRESENCE means "currently
# failing". One file per job, so concurrent jobs never contend and clearing is a
# single atomic unlink. An aggregate file would have needed a lock in exactly the
# code path whose job is to be reliable.
#
# ── crontab lines ─────────────────────────────────────────────────────────────
# Adopt one at a time; nothing here requires rewriting the crontab wholesale.
#
#   PROD  (/home/ubuntu/slang-coworkers-prod/nanoclaw)
#     45 5 * * * /home/ubuntu/slang-coworkers-prod/nanoclaw/scripts/cron-run.sh kb-health /usr/bin/python3 /home/ubuntu/slang-coworkers-prod/nanoclaw/scripts/kb-health.py --repo /home/ubuntu/slang-coworkers-prod/nanoclaw >> /home/ubuntu/slang-coworkers-prod/nanoclaw/logs/kb-health.log 2>&1
#     50 5 * * * /home/ubuntu/slang-coworkers-prod/nanoclaw/scripts/cron-run.sh kb-doctor /usr/bin/python3 /home/ubuntu/slang-coworkers-prod/nanoclaw/scripts/kb-doctor.py --repo /home/ubuntu/slang-coworkers-prod/nanoclaw --quiet >> /home/ubuntu/slang-coworkers-prod/nanoclaw/logs/kb-doctor.log 2>&1
#     15 6 * * * /home/ubuntu/slang-coworkers-prod/nanoclaw/scripts/cron-run.sh funnel /home/ubuntu/slang-coworkers-prod/nanoclaw/scripts/funnel-cron.sh
#
#   LEGO  (/home/ubuntu/haaggarwal/lego-nanoclaw)
#     45 5 * * * /home/ubuntu/haaggarwal/lego-nanoclaw/scripts/cron-run.sh kb-health /usr/bin/python3 /home/ubuntu/haaggarwal/lego-nanoclaw/scripts/kb-health.py --repo /home/ubuntu/haaggarwal/lego-nanoclaw >> /home/ubuntu/haaggarwal/lego-nanoclaw/logs/kb-health.log 2>&1
#     50 5 * * * /home/ubuntu/haaggarwal/lego-nanoclaw/scripts/cron-run.sh kb-doctor /usr/bin/python3 /home/ubuntu/haaggarwal/lego-nanoclaw/scripts/kb-doctor.py --repo /home/ubuntu/haaggarwal/lego-nanoclaw --quiet >> /home/ubuntu/haaggarwal/lego-nanoclaw/logs/kb-doctor.log 2>&1
#     15 6 * * * /home/ubuntu/haaggarwal/lego-nanoclaw/scripts/cron-run.sh funnel /home/ubuntu/haaggarwal/lego-nanoclaw/scripts/funnel-cron.sh
#
# kb-doctor is scheduled NOWHERE today, so .kb-doctor.json is never written and
# the dashboard's drift panel reports "unavailable" permanently. 50 5 keeps it
# beside the 05:45 kb-health run.
#
# NOT set here: MAILTO. If mail is not actually delivered on these boxes, setting
# it creates a SECOND silent path, which is worse than none. Verify delivery
# first; the marker + log work regardless.
# ──────────────────────────────────────────────────────────────────────────────
set -u

JOB="${1-}"
if [ -z "$JOB" ]; then
  echo "cron-run.sh: usage: cron-run.sh <job-name> <command> [args...]" >&2
  exit 64
fi
shift
if [ "$#" -eq 0 ]; then
  echo "cron-run.sh: no command given for job '$JOB'" >&2
  exit 64
fi

# Resolve the repo from this script's own location so a crontab line names it
# once, not twice, and a copied line cannot point its state at another install.
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/.." && pwd)"
STATE_DIR="${CRON_RUN_STATE_DIR:-$REPO/data/shared/.cron-failures}"
LOG="${CRON_RUN_LOG:-$REPO/logs/cron-failures.log}"
MARKER="$STATE_DIR/$JOB.json"

mkdir -p "$STATE_DIR" 2>/dev/null || true
mkdir -p "$(dirname "$LOG")" 2>/dev/null || true

# ── run it ───────────────────────────────────────────────────────────────────
# RC is captured on the very next line. Nothing may come between: `$(date)` in
# an echo is enough to reset $?, which is how funnel-cron.sh logged rc=0 for
# every failure it ever had. Output is NOT captured or piped — a pipeline would
# make $? the last stage's status, and the job's own log already has the detail.
"$@"
RC=$?
# ─────────────────────────────────────────────────────────────────────────────

STAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

if [ "$RC" -eq 0 ]; then
  if [ -f "$MARKER" ]; then
    rm -f "$MARKER" 2>/dev/null || true
    printf '[%s] CRON RECOVERED job=%s\n' "$STAMP" "$JOB" >> "$LOG" 2>/dev/null || true
  fi
else
  # python3 writes the JSON: quoting a command line into JSON from shell is a
  # reliable way to emit something that will not parse. Both boxes already run
  # python3 for kb-health/kb-doctor, so this adds no dependency.
  python3 - "$MARKER" "$JOB" "$RC" "$STAMP" "$REPO" "$@" <<'PY' 2>/dev/null || true
import json, os, sys, tempfile
marker, job, rc, stamp, repo = sys.argv[1:6]
cmd = sys.argv[6:]
prev = {}
try:
    with open(marker, encoding="utf-8") as fh:
        prev = json.load(fh) or {}
    if not isinstance(prev, dict):
        prev = {}
except Exception:
    prev = {}
doc = {
    "job": job,
    "repo": repo,
    "command": cmd,
    "exitCode": int(rc),
    "failedAt": stamp,
    # Kept across runs so an operator can see "failing since Tuesday" rather than
    # only "failed today", which reads as a one-off.
    "firstFailedAt": prev.get("firstFailedAt") or stamp,
    "consecutiveFailures": int(prev.get("consecutiveFailures") or 0) + 1,
}
d = os.path.dirname(os.path.abspath(marker))
os.makedirs(d, exist_ok=True)
fd, tmp = tempfile.mkstemp(dir=d, prefix=".cron-run.", suffix=".tmp")
try:
    with os.fdopen(fd, "w", encoding="utf-8") as fh:
        json.dump(doc, fh, indent=1)
        fh.flush()
        os.fsync(fh.fileno())
    os.replace(tmp, marker)
except Exception:
    try:
        os.unlink(tmp)
    except OSError:
        pass
    raise
PY
  printf '[%s] CRON FAILURE job=%s rc=%s cmd=%s\n' "$STAMP" "$JOB" "$RC" "$*" >> "$LOG" 2>/dev/null || true
fi

# The wrapped command's status, always, as the LAST statement.
#
# Everything above is guarded so a bookkeeping failure cannot abort the script
# before it gets here, and nothing after it can become the exit status. This is
# the trailing-`mv` bug — funnel-cron.sh always exited 0 because its last
# command was a log rotation, so cron never saw a failure either. Writing that
# into the wrapper built to fix it would be an exquisite own goal. There is
# deliberately no log rotation here for the same reason: one line per failure is
# small enough that logrotate can own it.
exit "$RC"
