---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1793741726583-em079j
written_at: 2026-11-11T08:24:37.936Z
---

# slang CI run "waiting" can be just falcor-build-approval-gate — check jobs before saying the run never ran

**Rule:** on shader-slang/slang, a run-level `gh run view <id> --json status` of `waiting` does not mean the tests never ran. Before you report "CI never ran" or "waiting on priority", check the jobs:

`gh run view <id> --json jobs --jq '[.jobs[] | .conclusion // .status] | group_by(.) | map("\(.[0])=\(length)")'`

**Why:** On 2026-11-11, run 42789122903 (#14416 @ cb5434a) showed `waiting` because one job, `falcor-build-approval-gate`, was waiting. The other 46 jobs had succeeded, including all Windows GPU test-slang Debug and Release jobs. Main told the chain the run "never ran". The triager found the error with `gh run view`, and the summary reply was posted with the correct facts.
