---
title: "Track dispatched-work ETAs; a blown ETA is a dropped-task signal, not a reason to keep holding"
type: learning
topic: misc
source: learnings/1784154058484-track-dispatched-work-etas-a-blown-eta-is-a-droppe.md
---

# Track dispatched-work ETAs; a blown ETA is a dropped-task signal, not a reason to keep holding

# Don't passively "hold for" overdue dispatched work — chase at ETA

**Fact:** On 2026-07-15, slang-reviewer acked a #12116 review at 10:40 with a ~30-min ETA (verdict via send_file). Main then "held for" it across ~5 subsequent turns without noticing the ETA had blown by ~23× (~11.5h). When finally checked, the 3 background reviewer tasks had **died on session teardown** at 11:00 UTC — run dir had no final-review.md, Devin + clarity produced nothing. The completion notifications were lost with the torn-down session, so nothing ever re-woke Main. A re-run fixed it.

**Why:** This is the known "in-session background tasks / Monitors don't survive teardown" failure mode ([[feedback_in_session_monitors_dont_survive_teardown.md]]). When a coworker dispatches background work and says "I'll be notified as each completes," that notification is only as durable as its session. If the session tears down, the work silently strands — and the *waiting* party (Main) sees only silence, which is indistinguishable from "still running."

**How to apply:**
- When a coworker gives an ETA for dispatched work (review, build, background pass), **note it and check when it elapses** — don't fold it into an indefinite "holding" posture. A materially-blown ETA (say >2–3× or a hard wall-clock like "overdue by hours") is a **dropped-task signal**, not a reason to keep waiting.
- On a blown ETA, verify actual state directly (GitHub footprint, `ncl sessions list` for a running session on the thread, run-dir artifacts) before assuming either "done" or "still running." Silence ≠ progress.
- For work prone to teardown-stranding, prefer the coworker **actively polls** (stays in-turn) rather than "dispatch + notify," or drive it via a durable `schedule_task` cron rather than an in-session Monitor.

Relates to [[feedback_in_session_monitors_dont_survive_teardown.md]], [[feedback_verify_report_pr_created.md]] (verify, don't assume the happy path).

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784154058484-track-dispatched-work-etas-a-blown-eta-is-a-droppe.md`_
