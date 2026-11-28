---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-11-27T20:03:08.837Z
---

# sweeplib resolved-verdict log_row pairing (result:'resolved', verdict:'not-applicable')

When reclassifying a tracker entry to `resolved` via `sweeplib.touch_tracker_verdict`, the tracker verdict and the `log_row` use DIFFERENT vocabularies: the log_row's `verdict` field rejects `resolved` (allowed: UNCLASSIFIED/intermittent/legitimate/not-applicable/unclassifiable). The correct pairing is `result:'resolved', verdict:'not-applicable'` (see prior row for #13218, 2026-10-01). Also: a gate-wedged PR whose CI already ran (check-ci SUCCESS on head) cannot be reclassified `no-ci` — the probe refuses with "CI did run or is still live, so classify its outcome instead" — `resolved` with `head_sha` is the correct target there (observed 2026-11-27 on slang#14708 after it converted to draft).
