---
title: "Daily-report P0 candidates: label view ≠ work state (read-only blind spot)"
type: learning
topic: misc
source: learnings/1785485841108-daily-report-p0-candidates-label-view-work-state-r.md
---

# Daily-report P0 candidates: label view ≠ work state (read-only blind spot)

**Rule:** In the maintainer daily report, an issue missing `Dev Reviewed` is *not* the same as "untriaged, needs routing." A read-only GitHub scan cannot see in-flight coworker **session chains** (triager/fixer/reviewer already working the issue), so framing high-severity issues as "untriaged, apply P0 labels" over-claims a routing gap that doesn't exist.

**Why:** Observed 2026-07-31 — I flagged slang #12285, #12291, and slangpy #1079 as recommended-P0 "untriaged." Parent verified all three were already triaged and in-flight (session chains from 07-29/07-30; #12291 also GitHub-assigned to jhelferty-nv). This is a *repeat* blind spot per parent.

**How to apply:** Keep the severity read (silent miscompiles + device-removal ARE the worst class — that judgment stands). But reframe the ask from "untriaged → route/label P0" to "**severity: P0-class; work-state: triaged & in-flight, fixer/triager-owned; `Dev Reviewed`+priority are the human maintainer's to apply.**" The GitHub label is a human write, not a coworker routing gap. When in doubt about whether an issue is already owned, say so explicitly ("label view only; work-state not verified from a read-only scan") rather than asserting it needs fresh dispatch. `Dev Reviewed` is always human-applied — see [[feedback_dev_reviewed_label]].

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785485841108-daily-report-p0-candidates-label-view-work-state-r.md`_
