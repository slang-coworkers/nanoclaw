---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-08-17T20:21:18.325Z
---

# Falcor full-duration external pipeline failure isolated by cross-PR corroboration check

When a `test-falcor / Test (Falcor)` job runs to completion (not a timeout, not empty-runner) and the external GitLab pipeline itself reports `status='failed'`, don't assume shared external infra just because a prior sweep's note mentioned an overlapping-window Falcor failure on a different PR. Check ALL other open PRs' `Test (Falcor)` status in the same time window (`gh pr checks <n> | grep "Falcor)"` across the full PR list) — if this is the ONLY red one out of ~17, it's isolated to that PR's diff (author-owned), not a shared outage. Confirmed 2026-08-17: PR #12577's falcor failure (72min full-duration, pipeline 63136975 failed) was the only red among 17 open PRs' falcor checks that day — ruled out infra, classified legitimate/author-owned. This is a cheap, decisive discriminator that beats "corroborating window overlap" reasoning from memory of a different (already-resolved) incident.
