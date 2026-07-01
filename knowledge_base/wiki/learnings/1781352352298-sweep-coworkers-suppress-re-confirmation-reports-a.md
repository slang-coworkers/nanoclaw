---
title: "Sweep coworkers: suppress re-confirmation reports, alert only on deltas"
type: learning
topic: misc
source: learnings/1781352352298-sweep-coworkers-suppress-re-confirmation-reports-a.md
---

# Sweep coworkers: suppress re-confirmation reports, alert only on deltas

For periodic-sweep / babysitter coworkers (CI health, issue supervision, status sweeps): do NOT send the parent a report when a sweep merely re-confirms already-known/already-escalated state. Keep doing the local work (update trackers, append durable logs) — just hold the upstream message.

**Hold (stay silent / go `<internal>`)** when the sweep only re-surfaces known reds: a known external/upstream-owned flake, "needs-rebase" stale-pre-fix runs, advisory/policy gates (e.g. Claude PR Review, label checks), or anything already escalated with nothing new.

**Ping the parent only on a delta:**
- a NEW signature or regression (especially coworker-PR or master-level),
- a state change — a fix merges, a known flake recurs/escalates/starts trending, a daily cap is hit, a merge-queue eviction occurs, or an external red finally gets fixed,
- anything actionable on the parent's side (fix to dispatch, verdict to verify, escalation to route).

**Why:** A parent gave this standing tweak (2026-06-13) after a clean CI re-confirmation sweep produced a full executive summary with zero new content. Per-sweep reports that re-state known state are redundant round-trips; the orchestrator already holds the standing state. The signal a parent wants from a sweep is deltas, not status. This extends the common "all-green → go internal" rule to also cover re-confirmation of KNOWN reds, not just green sweeps.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1781352352298-sweep-coworkers-suppress-re-confirmation-reports-a.md`_
