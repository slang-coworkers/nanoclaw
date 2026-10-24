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
# The gate has 30 s in total; transcript reads are the slow part (each ncl call is a serial session-DB
# round trip). PULL_END_BY makes the pull end on its own inside that budget: a killed `ncl` strands its
# reply row pending in the session's inbound.db, so the `timeout` is only a backstop. In-flight rows
# whose sessions were not all read draw no action; the gate wakes the agent to re-pull them (below).
export COLLECT_DEADLINE_S=${COLLECT_DEADLINE_S:-10}
export PULL_END_BY=${PULL_END_BY:-$(( $(date +%s) + ${GATE_PULL_S:-24} ))}
if command -v timeout >/dev/null 2>&1; then
  timeout "${GATE_BACKSTOP_S:-27}" bash "$AP/pull-state.sh" >"$LOG" 2>&1 || RC=$?
else
  bash "$AP/pull-state.sh" >"$LOG" 2>&1 || RC=$?
fi
python3 - "$AP/state.json" "$RC" <<'PY'
import json, sys
path, rc = sys.argv[1], int(sys.argv[2])
killed = rc == 124  # the backstop fired: the pull overran PULL_END_BY
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
# in-flight rows the transcript budget did not reach: their threads are null, so this tick could not judge them.
# "partial" keeps its meaning for the prompt's STEP 0 (re-run the pull, which has no end there).
in_flight = set(st.get("in_flight") or []) | set(st.get("follow_up_in_flight") or [])
unread = st.get("threads_unreadable") if isinstance(st.get("threads_unreadable"), dict) else {}
budget_unread = sorted(
    t[len("hermes-"):] for t, why in unread.items()
    if t[len("hermes-"):] in in_flight and any("deadline" in w or "max-sessions" in w for w in (why or []))
)
partial = killed or bool(budget_unread)
wake = bool(needs_turn) or partial
# operator_unread: the Orchestrator's operator DM / task sessions the collector listed but could not read this tick
# (pass 3 runs FIRST on its own 3 s reserve, so this is a slow `ncl`, not the row budget). Reported, never a wake:
# a rerun under the agent's budget faces the same reserve, and the asks resurface on the next tick that reads them.
sessions = (st.get("sources") or {}).get("sessions") if isinstance(st.get("sources"), dict) else None
operator_unread = (sessions or {}).get("operator_unread") if isinstance(sessions, dict) else None
print(json.dumps({"wakeAgent": wake, "data": {
    "partial": partial, "pull_rc": rc, "budget_unread": budget_unread, "actions": kinds,
    "rows": sorted({a.get("row") for a in needs_turn if a.get("row")})[:10],
    "in_flight": len(st.get("in_flight") or []), "generated_at": st.get("generated_at"),
    "errors": len(st.get("collector_errors") or []),
    "operator_unread": operator_unread,
}}))
PY
