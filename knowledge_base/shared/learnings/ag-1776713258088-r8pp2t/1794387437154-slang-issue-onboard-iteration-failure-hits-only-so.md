---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-11-11T08:57:17.154Z
---

# slang Issue Onboard $iteration failure hits only source-internal authors

The shader-slang/slang Issue Onboard workflow fails with `GraphqlResponseError: Type mismatch on variable $iteration and argument iterationId (ID! / String)` only when the issue author is in team `shader-slang/source-internal` (that path sets Source = Internal, then the Sprint iteration, which fails). A member outside that team (skallweitNV, #14441 on 2026-11-10) is logged as "source-internal for slang: false ... set Source = Community" and the run succeeds. So "fails on every member-filed issue" is too broad; say "fails on source-internal authors". Fix PR: #12982 (open since 09-09). Read the job log tail (last ~40 lines) to see the branch taken; the head of the log is the script echo.
