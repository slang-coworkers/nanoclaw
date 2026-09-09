#!/usr/bin/env bash
# gate-supervise.sh: the `ncl tasks --script` gate for the supervise tick (47 */2 * * *).
# Runs inside the Orchestrator container before the agent wakes: 30 s budget, last stdout line JSON.
# Wakes the agent only when the supervisor emitted an action that needs a turn (gate, nudge, alert;
# a bare `hold` is a note the agent picks up when woken for something else) or when the pull timed
# out (partial: the prompt reruns it). A quiet tick costs zero tokens and still leaves a fresh
# state.json for the human's check.
set -uo pipefail
AP=${AUTOPILOT_DIR:-/workspace/shared/hermes/autopilot}
LOG=$AP/gate-supervise.log
mkdir -p "$AP"
RC=0
# The gate has 30 s in total; transcript reads are the slow part (each ncl call is a session-DB
# round trip). Give the collector a fixed budget so the pull finishes and writes a fresh state.json;
# in-flight rows whose sessions were not all read are marked unreadable and draw no action.
export COLLECT_DEADLINE_S=${COLLECT_DEADLINE_S:-10}
if command -v timeout >/dev/null 2>&1; then
  timeout 22 bash "$AP/pull-state.sh" >"$LOG" 2>&1 || RC=$?
else
  bash "$AP/pull-state.sh" >"$LOG" 2>&1 || RC=$?
fi
python3 - "$AP/state.json" "$RC" <<'PY'
import json, sys
path, rc = sys.argv[1], int(sys.argv[2])
partial = rc == 124
try:
    st = json.load(open(path, encoding="utf-8"))
except (OSError, ValueError) as exc:
    print(json.dumps({"wakeAgent": True, "data": {"partial": True, "pull_rc": rc, "error": f"state.json unreadable: {exc}"}}))
    sys.exit(0)
actions = [a for a in (st.get("actions") or []) if isinstance(a, dict)]
kinds = {}
for a in actions:
    kinds[a.get("kind", "?")] = kinds.get(a.get("kind", "?"), 0) + 1
needs_turn = [a for a in actions if a.get("kind") != "hold"]
wake = bool(needs_turn) or partial
print(json.dumps({"wakeAgent": wake, "data": {
    "partial": partial, "pull_rc": rc, "actions": kinds,
    "rows": sorted({a.get("row") for a in needs_turn if a.get("row")})[:10],
    "in_flight": len(st.get("in_flight") or []), "generated_at": st.get("generated_at"),
    "errors": len(st.get("collector_errors") or []),
}}))
PY
