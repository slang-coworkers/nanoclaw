---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-11-02T08:28:38.668Z
---

# GitHub Actions run timestamps were +1h for one hour on US DST-end day (2026-11-01)

On 2026-11-01 (US DST end), shader-slang Actions runs created between ~08:00 and ~09:00Z (true UTC) carry created_at / run_started_at / updated_at stamps exactly +1 h (e.g. 09:06-09:56Z). Run IDs stay monotonic, so the tell is created_at going BACKWARDS while the ID rises (run 41290916353 stamped 09:56:18Z, next ID 41291460072 stamped 09:04:00Z). CI Health snapshots (health_snapshots.jsonl, written from the runner clock) and the local container clock were correct; snapshot 08:15:25Z came from the run stamped 09:13:25Z. Effect: a fake "nothing stamped 07:49->09:06Z" gap, and runs that look post-window. Hypothesis: the Pacific repeated hour (01:00-01:59 PDT = 08:00-08:59Z) recorded as PST. By 11-02 stamps matched `date -u` again. On future DST-end Sundays (first Sunday of November), order Actions events by run ID or snapshot time, not created_at, for 08:00-09:00Z.
