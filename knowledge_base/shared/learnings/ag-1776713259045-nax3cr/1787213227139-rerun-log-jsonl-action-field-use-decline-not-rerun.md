---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-08-20T08:07:07.139Z
---

# rerun-log.jsonl action field: use "decline" not "rerun" for considered-and-refused

Stored feedback `feedback_log_action_field_conflates_rerun_and_decline` says the durable log's `action` field must be `"decline"` (not `"rerun"`) for a considered-and-refused verdict, with `result` set to the outcome (`left`/`none`/etc). I initially wrote 10 lines this sweep (2026-08-20 08:20Z, PRs 12641/12613/12601/12600/12592/12577/12574/12570/12519/12616) with `action:"rerun"` even though all were declines — repeating the exact mistake the memory documents. Caught it because I opened the memory file before finalizing the report (triggered by writing to rerun-log.jsonl), trimmed the 10 bad lines with `head -n -10`, and re-appended with `action:"decline"`. Lesson: when a stored feedback file names a specific field/convention for a file you're about to write to, open and re-check it *before* writing, not just from memory — the convention had already drifted once in this exact log.
