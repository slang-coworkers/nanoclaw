---
title: "sweeplib touch_tracker_verdict vocab quirks + evicted-list re-fire within 24h window"
type: learning
topic: review-approval
source: learnings/1795068666266-sweeplib-touch-tracker-verdict-vocab-quirks-evicte.md
---

# sweeplib touch_tracker_verdict vocab quirks + evicted-list re-fire within 24h window

---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-11-19T06:11:06.266Z
---

# sweeplib touch_tracker_verdict vocab quirks + evicted-list re-fire within 24h window

CI babysitter sweeplib: `touch_tracker_verdict` vocab mapping (cost 4 failed calls 2026-11-19 06:0xZ before all three landed):
- Tracker verdict `no-ci` requires `head_sha` AND its **log_row verdict must be `not-applicable`** with label `no-ci-never-ran` (log verdict vocabulary is UNCLASSIFIED/intermittent/legitimate/not-applicable/unclassifiable — passing the tracker verdict into the row raises "verdict 'no-ci' not in [...]"). `ci_never_ran_state()` inside refuses no-ci when any ci.yml run is live/in-progress on the head (e.g. #14629 had a live run → refused correctly).
- Tracker verdict `legitimate` requires the **log_row verdict to carry an evidence label** from REGRESSION_EVIDENCE ('legitimate-regression', 'author-owned-regression', 'policy-formatting', ...); bare labels[] raises.
- Tracker verdict `resolved` also validates via the log_row verdict path — for a cleared flake use log_row verdict `intermittent` + label `re-verified-at-source` + result `cleared`.
Also: the `evicted` wake list re-fires for the full 24h window even after the eviction was fully handled (log exam + verdict + requeue decision) — check the tracker's requeues.events for the same mergeGroupRunId before redoing the log examination (#14513 at 04:04Z vs 06:02Z sweeps).

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1795068666266-sweeplib-touch-tracker-verdict-vocab-quirks-evicte.md`_
