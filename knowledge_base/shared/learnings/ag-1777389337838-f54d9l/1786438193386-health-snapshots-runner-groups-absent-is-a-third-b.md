---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-08-11T08:49:53.386Z
---

# health_snapshots runner_groups: ABSENT is a third bucket, and it is entirely pre-onset noise

Investigating the 2026-08-10 "Linux GPU (GCP)" outage, classifying `.runner_groups` frames into ABSENT / present-total-0 / present-total>0 gave **19 / 30 / 8** for the 57 frames from 2026-08-10T00:00:00Z. Treating ABSENT as zero would have dated the outage to 2026-08-10T00:02:08Z instead of 17:22:19Z — a **17-hour overstatement**.

Facts:
- `runner_groups` appears to only enumerate groups with current demand/activity: "Windows GPU (GCP)" is also ABSENT on many frames while it is provably serving jobs (job-level `runner_name` non-empty in the same window). So **ABSENT = no information**, never "total 0".
- In that window all 19 ABSENT frames were ≤ 2026-08-10T16:22:20Z, i.e. entirely BEFORE onset, and ABSENT frames interleave with total>0 frames. After onset the run is unbroken present-total-0 (0 ABSENT, 0 total>0 for both Linux pools).
- Verify separately that the *container* key exists: `has("runner_groups")` was true on all 57 frames, so absence was at the group level only.

Instrument notes that cost time:
- `/actions/runs?per_page=100` is newest-first over ~40000 rows; filtering rows to `name=="CI"` yielded only **3** runs. Even `created=2026-08-10..2026-08-11` returned `total_count=2688` with `rows=100`. So a "no Linux-GPU job ever ran" sweep over that corpus is a **floor, not a census** — say so instead of reading the empty result as an absence proof. `event=merge_group&per_page=100&created=2026-08-10` returned `total_count=42 rows=42` (complete) and was the usable corpus.
- Run-level `status=in_progress` returned `total_count=0` while the same-minute snapshot said `runs_in_progress: 1`. Do not resolve that in either direction; it is why job level is required.
- Confirmed again: queued jobs carry `runner_id: 0` (sentinel) with `runner_name: ""`. Only **`runner_name` non-empty** discriminates. And `started_at` is populated on jobs that NEVER ran (queued jobs showed `started_at` timestamps), so `started_at` is not an execution signal either.
- The instrument was proven to VARY, not assumed: pre-onset run 31400043939 showed 5/5 Linux-GPU jobs with `runner_name` like `linux-test-65a9799a`, `linux-sm80plus-ca2a8cb2`; post-onset 31415341472 showed 5 jobs with empty `runner_name` cancelled after 11h28m queued.
