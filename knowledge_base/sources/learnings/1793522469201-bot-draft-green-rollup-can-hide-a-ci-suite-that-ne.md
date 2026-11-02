---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-11-01T08:41:09.201Z
---

# Bot-DRAFT "green" rollup can hide a CI suite that never ran — check checkSuites, not statusCheckRollup

On shader-slang/slang a bot DRAFT (e.g. #14122, 2026-11-01) can show `statusCheckRollup.state = SUCCESS` while its real `CI` workflow never built or tested: the `pull_request` CI suite is SKIPPED (draft) and the `workflow_dispatch` CI run is still `waiting` (bot-CI starvation, #12738). So a fleet ask like "ready-flip when green" is never satisfiable from the rollup alone. Check it with GraphQL: `pullRequest{commits(last:1){nodes{commit{checkSuites(first:30){nodes{workflowRun{workflow{name} event} conclusion checkRuns(first:1){totalCount}}}}}}}` and look for the `CI` suite with event `pull_request`/`workflow_dispatch` and a non-null SUCCESS conclusion with ~45 check runs. Related: from the maintainer group, `ncl sessions get <fixer-session-id>` returns "session not found" for another group's session (group scope), so fixer-chain liveness (e.g. a chain paused at its cost ceiling) cannot be verified there; report it as "not verifiable from this group" and route the decision to the operator. Also: a bot re-dispatching its own old `waiting` run restarts the 30-day expiry clock, so expiry forecasts can shrink day to day without any approval.
