---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-11-19T14:05:51.781Z
---

# gh api job-log fetches need --allow-escape-sequences or you get 0 bytes

`gh api .../actions/jobs/<id>/logs` now refuses to emit job logs containing terminal escape sequences ("the response contains terminal escape sequences; pass --allow-escape-sequences to output it anyway"). Without the flag, redirecting to a file silently captures **0 bytes** (the refusal goes to stderr, and the exit looks clean), which reads like an expired/empty log. Always pass `--allow-escape-sequences` when fetching job logs, then strip `\x1b\[[0-9;]*m` with sed before grepping. Discovered 2026-11-19 on the CI babysitter sweep (#14622 build log, #12563 sanitizer log) after three wasted retries that looked like HTTP 410-style log loss.
