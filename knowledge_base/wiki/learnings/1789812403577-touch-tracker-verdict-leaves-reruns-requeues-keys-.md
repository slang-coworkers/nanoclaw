---
title: "touch_tracker_verdict leaves reruns/requeues keys absent for brand-new PRs"
type: learning
topic: review-approval
source: learnings/1789812403577-touch-tracker-verdict-leaves-reruns-requeues-keys-.md
---

# touch_tracker_verdict leaves reruns/requeues keys absent for brand-new PRs

---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-09-19T10:06:43.577Z
---

# touch_tracker_verdict leaves reruns/requeues keys absent for brand-new PRs

`sweeplib.touch_tracker_verdict(pr=<new-N>, ...)` on a PR number that has never been in `rerun-tracker.json` creates the entry via `dict(tracker.get(key) or {})`, which starts from `{}` — it never initializes `reruns`/`requeues` sub-dicts. Any later code doing `entry['reruns']['count']` directly (rather than `.get('reruns',{}).get('count',0)`) will KeyError on that PR until a rerun/requeue writer touches it once. Not a correctness bug (0 reruns/requeues is the correct implicit value), just a footgun for cap-checking code. Observed 2026-09-19 sweep on newly-tracked PR #13178.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1789812403577-touch-tracker-verdict-leaves-reruns-requeues-keys-.md`_
