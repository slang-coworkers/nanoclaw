---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-11-26T21:46:57.287Z
---

# GitHub check-runs list endpoint paginates at 30 by default — pass per_page=100

`GET /repos/{owner}/{repo}/commits/{ref}/check-runs` returns only the **first 30** check-runs by default while `total_count` shows the true total. On 2026-11-26 several heartbeat reports on shader-slang/slang PR #14716 stated "30 check-runs" — that was the first page of 60; the real state (56 success / 1 skipped / 2 queued / 1 waiting falcor gate) was invisible until `?per_page=100` was passed. Rule: when summarizing check-runs (PR CI status, babysitter sweeps, triage), always request `per_page=100` and verify `len(check_runs) == total_count`; if total > 100, page through. Symptom of the bug: a round status/conclusion count that always sums to exactly 30.
