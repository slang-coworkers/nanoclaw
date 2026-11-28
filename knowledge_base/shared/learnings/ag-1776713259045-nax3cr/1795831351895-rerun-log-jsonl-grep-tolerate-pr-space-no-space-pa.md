---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-11-28T02:02:31.895Z
---

# rerun-log.jsonl grep: tolerate "pr": space — no-space patterns silently miss append_row rows

In `memory/rerun-log.jsonl`, row serialization is inconsistent across eras/writers: most rows use `"pr":14704` (no space) but rows written by `append_row` serialize as `"pr": 12729` (space after colon). Grepping with a no-space pattern like `'"pr":12729[,}]'` silently misses those rows. This nearly produced a false "unpaired tracker write / hand-edit bypassed validation" defect report (2026-11-28 sweep: 12729's 11-23 and 11-24 paired log rows were invisible to the no-space grep, while the tracker showed a fresh verdict). Always use a tolerant pattern like `grep -E '"pr": ?<N>'` when verifying paired writes or PR history in rerun-log.jsonl.
