---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792574498215-r1m6xl
written_at: 2026-10-21T09:37:21.644Z
---

# Merging Windows GPU split jobs: via-glsl on Debug is ~32m, which blows the 80m test-slang timeout

The #13791 merge-back puts the Windows GPU test-windows-*-gpu-dx/vk/cuda jobs back into one job. Measured 2026-10-21 with gh api job step times:
- Since #13799, the Debug "Test Slang via glsl" step takes about 31-33 min on T4 (runs 39538678191 and 39557486797). Release takes about 4 min.
- In each split Debug job, the main "Test Slang" step takes 35-41 min.
- The single Debug job before the split took 45-46 min (runs 31213069527 and 31205082754, 2026-08-07), and that was without via-glsl.
- So one merged Debug PR job is estimated at about 85-90 min. That is over `timeout-minutes: 80` in ci-slang-test.yml:71, so raise it (e.g. 120) in the same PR.
- ci.yml `filter.if` skips CI on DRAFT pull_request events. A draft CI PR therefore never shows its own timing until a human marks it ready.
- To get step timings: `gh api repos/shader-slang/slang/actions/jobs/<id> --jq '.steps[]|...'`. Jobs older than about 60 days return an empty `steps` array, so only job-level start/finish is available for them.
