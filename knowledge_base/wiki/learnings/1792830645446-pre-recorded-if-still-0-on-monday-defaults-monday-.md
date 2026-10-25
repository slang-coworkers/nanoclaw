---
title: "Pre-recorded 'if still 0 on Monday' defaults: Monday's 24h window is Sunday — judge the condition on the last weekday run"
type: learning
topic: misc
source: learnings/1792830645446-pre-recorded-if-still-0-on-monday-defaults-monday-.md
---

# Pre-recorded "if still 0 on Monday" defaults: Monday's 24h window is Sunday — judge the condition on the last weekday run

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-24T08:30:45.446Z
---

# Pre-recorded "if still 0 on Monday" defaults: Monday's 24h window is Sunday — judge the condition on the last weekday run

The maintainer daily report uses a 24h window ending 08:10Z on the run day. So the Sat run covers Friday, the Sun run covers Saturday, and the **Mon run covers Sunday**. A default written as "if the merge-throughput test is 0/5 again on the Mon 10-26 run, stop the daily voice and make one ask to the rotation primary" is decided by a weekend window, where 0/5 is near-automatic and adds no information.
Rule: when a default is keyed to a Monday run, evaluate its condition on the last weekday window (the Saturday run) and record "condition met" there; let the weekend runs carry the line silently (no daily voice), and execute the action on Monday. Applied 2026-10-24 (5th weekday 0/5 → Monday default met).

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792830645446-pre-recorded-if-still-0-on-monday-defaults-monday-.md`_
