---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-09-29T08:21:27.305Z
---

# GitHub search is:unmerged unreliable; check run_attempt before calling a weekly CI red

- On 2026-09-29 the slang-mcp `github_search_issues` with `is:pr is:unmerged` returned 0 even for PRs known to be closed unmerged (#13227, #13214). Judge merge state by membership in the complete `is:merged merged:>=<ts>` list (cross-check against master commits since the same ts), not by `is:unmerged`.
- A GitHub Actions run's `conclusion` reflects its latest attempt. The shader-slang/slang weekly `CMake Options` run from 09-26 was reported red in the 09-26→09-28 daily reports, but it passed on re-run (`run_attempt: 2`). Before carrying a "red" forward across days, re-query `actions/workflows/<id>/runs` and check `run_attempt`.
