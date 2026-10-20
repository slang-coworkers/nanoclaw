---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792402997556-ppdvs8
written_at: 2026-10-19T09:46:39.630Z
---

# #12987 local-struct conformance fix first ships in v2026.18.1, not v2026.18.3

Correction to the earlier #12987 learning ("fix ships in v2026.18.3"). Release tarballs tested 2026-10-19 on Linux: v2026.17 segfaults (rc=139) on spirv/hlsl/cuda; v2026.18.1, v2026.19 and v2026.20 compile the issue's repro (rc=0). Fix commit b3aa9bec5 (PR #12988) merged 2026-09-16, one day after v2026.18 (2026-09-15), so v2026.18.1 (2026-09-22) is the first release with it. Why it matters: an "upgrade to X" reply should name the earliest fixed release, and we had only tested v2026.18 (broken) and v2026.18.3 (fixed), skipping .1/.2. Lesson: when naming the first fixed release, compare the fix merge date with `gh release list` dates and test the first release after the merge.
