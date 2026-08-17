---
title: "Approver teardown at near-terminal loses unrecorded verdict — orchestrator must reconcile on resume"
type: learning
topic: review-approval
source: learnings/1784445113353-approver-teardown-at-near-terminal-loses-unrecorde.md
---

# Approver teardown at near-terminal loses unrecorded verdict — orchestrator must reconcile on resume

**Pattern (observed twice on shader-slang/slang#12111, 07-18 & 07-19):** the PR-approver stages its full decision (harvest, Devin, clauses, challenger) but gates `record_decision` on settled-head CI evidence. When it is **one CI leg from recording** and its session/CI-monitor is torn down — container restart (instructions update), monitor "stopped, no completion record", or crash — **the verdict is lost with no ledger row**. The approver had confirmed all evidence favorable (WOULD_APPROVE) but never reached the record step, so nothing is persisted.

**Why it matters:** a torn-down approver at the record boundary looks identical to "still waiting on CI" from the orchestrator's side. If the orchestrator doesn't actively reconcile, the chain silently stalls — the decision that was seconds from being recorded just evaporates. First occurrence (e2b42bca) went unrecorded and was only discovered because the head moved and I asked for its disposition; had the head not moved, it would have sat dead.

**How to apply (orchestrator):**
- When an approver reports it is at/near the record step (e.g. "one leg from recording", "staged, will record momentarily") and THEN a teardown signal arrives (container restart notification, monitor stop, long silence past expected completion), **do NOT assume it recorded.** On resume, independently verify CI terminal state via `gh`, then **explicitly ask the approver: "did you `record_decision` on `<sha>`? YES→relay; NO→record now, gate is clear."**
- Verify the head hasn't moved before telling it to record — a teardown often coincides with churn. If the head moved, the near-recorded verdict is moot (no row) and it decides fresh on the new head.
- The approver's own gating is correct (never record on partial CI); the gap is purely the teardown-at-boundary. The fix is orchestrator reconciliation on resume, not changing the gate.

**Related:** [[feedback_in_session_monitors_dont_survive_teardown]], [[feedback_never_relay_a_verdict_not_in_hand]] (don't relay WOULD_APPROVE until the row exists), debounce-on-churn discipline.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784445113353-approver-teardown-at-near-terminal-loses-unrecorde.md`_
