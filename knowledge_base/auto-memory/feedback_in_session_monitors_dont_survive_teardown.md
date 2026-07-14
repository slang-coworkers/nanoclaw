---
name: feedback_in_session_monitors_dont_survive_teardown
description: In-session Monitor/background-shell guards die on session teardown; use schedule_task (host cron) for anything that must span a session gap
metadata: 
  node_type: memory
  type: feedback
  originSessionId: beb5496a-e417-4c00-93d7-b335f9d39609
---

**In-session Monitor tasks and background shells do NOT survive a session teardown.** NanoClaw sessions are ephemeral — torn down during inactivity, respawned on the next inbound. Anything running *inside* a session (a `Monitor` poller, a background `Bash` watchdog, an in-flight ~20-30 min review pipeline) is killed when the session is torn down, silently and without firing.

**Why it matters:** Observed on #12060 (2026-07-13). A ~42h gap (Jul 11→13) tore down both the approver's and reviewer's sessions mid-run. Two casualties: (a) the reviewer's in-flight review pipeline was killed before producing/delivering a doc — looked like a "silent hang"; (b) the approver's in-session doc-delivery watchdog Monitor was killed *without firing* — the very guard meant to catch the hang evaporated with the gap it was meant to cover. This was NOT the [[project_coworker_named_edge_dropped_silent_hang]] edge bug — that fix still held; this is a distinct teardown failure mode. It's expected lifecycle behavior, not an infra incident → no operator escalation.

**How to apply:**
- For any guard/poller that must span a possible session gap (detect "head quiet ≥15 min", "doc not delivered in 60 min", re-dispatch after teardown), use a **host-level `schedule_task` cron**, never an in-session Monitor. schedule_task survives teardown and restarts.
- Make the cron **stateless-per-fire + idempotent**: persist progress keyed on an identity (e.g. PR head SHA) to a workspace file; on each fire re-derive state so a respawn never double-dispatches for work already done.
- **Settling is the absence of an event** — webhooks can signal a push but never "nothing happened for 15 min," so a poll/cron is the only way to detect a settled head. Webhook forwarding is the wake signal for *activity*; the cron covers *quiet* + *delivery timeout*.
- Guard the cron with a bash `script` (GitHub API read-only checks) so it only wakes the agent when there's real work — cheap on idle fires.
- Teardown recovery falls out for free: next cron fire sees "settled, no doc for this SHA" → re-dispatch. A stranded run is wasted but the chain always converges once head is stable AND system is up.
- Cancel the task when the guarded work reaches a terminal state (PR leaves OPEN / verdict recorded).
