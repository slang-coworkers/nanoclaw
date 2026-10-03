---
title: "touch_tracker_verdict now requires a paired log_row — the pairing invariant moved from prose to code"
type: learning
topic: review-approval
source: learnings/1791004403685-touch-tracker-verdict-now-requires-a-paired-log-ro.md
---

# touch_tracker_verdict now requires a paired log_row — the pairing invariant moved from prose to code

---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-10-03T05:13:23.685Z
---

# touch_tracker_verdict now requires a paired log_row — the pairing invariant moved from prose to code

**Context:** `sweeplib.py`'s `touch_tracker_verdict()` (tracker-only writer) and `append_row()`
(rerun-log.jsonl writer) were always meant to be called together, but that was only ever a prose
convention in the sweep prompt (`live-prompt-current.txt`). Gates 0c/0d showed both calls paired
in their instruction text; gates 0g (reconfirm/retire-closed) and 0i (never-classified) showed
`touch_tracker_verdict()` standalone. A "nothing changed" sweep (session
`sess-1776714514351-hia2o3`, 2026-10-03T02:04Z) hit exactly that gap: 18 PRs got
`touch_tracker_verdict` calls with zero paired `append_row` rows, invisible to both
`audit_summary_rows` (only checks `sweep_summary` rows) and `audit_bypassed_rows` (only checks
`append_row`'s own schema — it has no way to detect a tracker write with NO log row at all, since
there's nothing on the log side to inspect).

**Fix (2026-10-03):** `touch_tracker_verdict(pr, verdict, at, log_row, ...)` now takes `log_row` as
a **required positional** parameter. It calls `append_row(log_row)` itself, BEFORE touching the
tracker — so a schema-invalid `log_row` raises before the tracker is mutated, and a missing/non-dict
`log_row` raises immediately. This closes the gap at the only place it can actually break, per
parent's framing: "the fix belongs where the invariant can break, not in a new audit that catches
it afterwards."

**Lesson for future sweeplib changes:** when two writers are meant to be called together, don't
rely on prompt prose repeating both calls at every call site — one gate will eventually show only
one. If the invariant matters, make the function signature enforce it (merge the two calls, or make
one a required argument of the other) rather than auditing after the fact.

**Also:** `touch_tracker_verdict`'s `at` parameter means "now" (wall-clock write time), never a
historical value to preserve — passing an old `last_verdict_at` as `at` while only updating
`issue_refs` backdates the paired log row's `ts` to the wrong time. If you need to add metadata
(like `issue_refs`) to an entry without a fresh CI re-check, still pass the real current timestamp
as `at`.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1791004403685-touch-tracker-verdict-now-requires-a-paired-log-ro.md`_
