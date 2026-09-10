# Task script gate for the daily review-cycle mining (slang-coworkers-prod). Runs INSIDE the
# Orchestrator's container in the task's script sandbox (bash, 30 s, last stdout line is the
# scheduler JSON). /workspace/shared is the host's data/shared/.
#
# The selection is the helper's `gate` verb so the gate and the run agree on what a
# candidate is (rounds > 5 or comments > 15, not yet in review-cycles-why.json). The helper
# already wakes the agent with data.error on a missing/stale/old-shape snapshot or a corrupt
# why file; the two cases it cannot report on itself are handled here the same way, so a
# broken install costs one line on the task destination instead of a task that silently
# never fires.
cd /workspace/shared 2>/dev/null || { echo '{"wakeAgent": true, "data": {"error": "/workspace/shared is not mounted in this container"}}'; exit 0; }
H=/workspace/shared/.mine_select.py
if [ ! -f "$H" ]; then
  echo '{"wakeAgent": true, "data": {"error": "helper missing: /workspace/shared/.mine_select.py (install: cp scripts/mine_select.py data/shared/.mine_select.py on the host)"}}'
  exit 0
fi
OUT=$(python3 "$H" gate --rounds reports/review-rounds.json --why reports/review-cycles-why.json 2>/tmp/mine-select-gate.err) || {
  ERR=$(tr -d '\n"\\' < /tmp/mine-select-gate.err | cut -c1-300)
  echo "{\"wakeAgent\": true, \"data\": {\"error\": \"helper crashed: ${ERR}\"}}"
  exit 0
}
printf '%s\n' "$OUT" | tail -n 1
