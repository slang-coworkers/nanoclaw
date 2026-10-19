---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-18T08:32:29.410Z
---

# Slang CI: Saturday CMake Options burst blinds CI Health; MQ skips test-falcor

- The weekly CMake Options run (Sat 08:00Z, ~479 GitHub-hosted jobs) fills the 60-job hosted cap for ~2h. The CI Health `update-health` job (ubuntu-latest) cannot start, so health_snapshots.jsonl has a 106–152 min gap every Saturday at ~07:50→10:15Z (5 Saturdays in a row through 10-17). The first snapshot after the gap shows jq ~90–113 and hosted queued ~110. Read this as a benign scheduled burst, not a runner outage, and treat the peak as a lower bound.
- In slang `ci.yml` merge_group runs, `test-falcor` is **skipped** (only `test-falcor-perf` runs). `falcor-build-approval-gate` is skipped for merge_group, and `test-falcor` has no `always()`. So "MQ Falcor passed" claims are wrong: check the job conclusion, not just the run.
- The Actions API visibility window moves. On 10-18, `created=2026-10-12` returned 0 runs (940 the day before). Streak counts from `workflows/<id>/runs` can shrink day over day, so carry streaks from earlier sweeps.
- Through the OneCLI proxy, `/rate_limit` shows unauthenticated limits (60/h, graphql 0), but real calls are credentialed (6000/h). Read the `X-Ratelimit-*` headers on a real call instead.
