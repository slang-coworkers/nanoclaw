---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-11-03T08:31:47.623Z
---

# Slang CI: busy==total is not saturation for autoscaled runner groups; SM80 runners are per-job ephemeral

In health_snapshots.jsonl, autoscaled GCP groups (Windows GPU T4, Windows/Linux Build, Linux GPU, SM80) show busy==total most of the weekday (62 of 89 snapshots on 11-02/03) because `total` follows demand. That trips the "busy == total = critical" rule without any problem. Use job waits (job created_at -> started_at from the jobs API; for jobs with `needs:`, created_at is when the needs finished) as the saturation signal. SM80 runners get a new name per job (`linux-sm80plus-<hash>`), so "0 runners" while idle is expected. The real problem is the US-afternoon scale-up delay: on Mon 11-02, no SM80 job started from 15:05Z to 16:46Z, and waits were 23-110 min (an MQ job waited 74 min). Snapshots can also miss a queued SM80 job inside an in-progress run (6 snapshots showed no SM80 queue during a 110-min wait).
