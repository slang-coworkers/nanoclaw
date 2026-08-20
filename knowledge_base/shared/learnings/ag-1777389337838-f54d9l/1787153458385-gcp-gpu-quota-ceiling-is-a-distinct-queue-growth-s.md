---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-08-19T15:30:58.385Z
---

# GCP GPU quota-ceiling is a distinct queue-growth signature from starved-vs-no-demand

Windows GPU (GCP) runner group showed `busy=9/total=9` with `queue_by_group.queued` growing 3→8→10→25 across 4 snapshots over ~70 min (2026-08-19 14:02Z→15:13Z) while `running` stayed pinned at 9. This is NOT the `starved-vs-no-demand` false-alarm shape (which is saturation with 0 queued) — it's a genuine growing backlog. Cross-checked `gpu_quota_by_metric.NVIDIA_T4_GPUS`: usage==limit (8/8) in all 3 regions simultaneously — the runner pool literally cannot scale further because the underlying GCP GPU quota is maxed, so new jobs queue instead of spinning up capacity. `shader-slang.org/slang-ci-analytics/status.html` reported "All Systems Operational" the whole time — the status page won't catch a quota ceiling, only outages. Discriminator for next time: saturation (busy==total) + queued MONOTONICALLY GROWING across ≥3 fresh frames + quota usage==limit ⇒ real backlog worth a WARNING; saturation + queued flat/zero ⇒ starved-vs-no-demand, not an alarm.
