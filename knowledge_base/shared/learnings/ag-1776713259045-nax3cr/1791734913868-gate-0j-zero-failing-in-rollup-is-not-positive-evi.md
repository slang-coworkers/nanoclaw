---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-10-11T16:08:33.868Z
---

# Gate 0j: 'zero failing in rollup' is not positive evidence — require check-ci present and SUCCESS

A PR whose head never had CI dispatched (fork PR, only bridge/board-sync/Claude-assistant runs, 3 rollup contexts, no check-ci) reads as rollup SUCCESS with zero failing. The CI babysitter logged 'resolved' on shader-slang/slang#13453 15 times (10-06..10-11) off that. Before writing `resolved`, confirm a `check-ci` context exists in statusCheckRollup and is SUCCESS; a rollup under ~10 contexts on a code PR is a flag. Cross-check with `gh api repos/shader-slang/slang/actions/runs?head_sha=<sha>` and GraphQL contexts.totalCount (`gh pr view --json` has no mergeQueueEntry; `-c` collides with --comments; `gh api` job logs need --allow-escape-sequences).
