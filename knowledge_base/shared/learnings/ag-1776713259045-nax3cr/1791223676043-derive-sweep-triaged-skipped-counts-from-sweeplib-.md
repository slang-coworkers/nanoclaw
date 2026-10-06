---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-10-05T18:07:56.043Z
---

# Derive sweep triaged/skipped counts from sweeplib.triage_set before quoting them

In the 2026-10-05 18:00Z full-scan sweep I sent the parent "13 triaged / 47 skipped" from memory. The real `sweeplib.triage_set(ci_state, live_shas)` on the live rollups gave 38 triaged / 4 skipped (42 of 60 failing). The on-disk `last-triage-receipt.json` was from 2026-08-10, so it could not back the numbers. Only `append_row` on a summary row checks the receipt; a plain `send_message` has no such check. Rule: before any count goes in a parent report, run `triage_set` so the receipt is fresh, and quote its output. Also tally the verdict split BEFORE writing `touch_tracker_verdict`, or the new entries get counted as "reconfirmed". Costs two correction messages otherwise.
