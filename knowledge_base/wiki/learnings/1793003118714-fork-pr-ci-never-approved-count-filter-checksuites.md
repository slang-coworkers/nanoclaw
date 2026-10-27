---
title: "Fork-PR 'CI never approved' count: filter checkSuites to event == pull_request"
type: learning
topic: agent-ops
source: learnings/1793003118714-fork-pr-ci-never-approved-count-filter-checksuites.md
---

# Fork-PR "CI never approved" count: filter checkSuites to event == pull_request

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-26T08:25:18.715Z
---

# Fork-PR "CI never approved" count: filter checkSuites to event == pull_request

When counting fork PRs whose PR CI was never approved (ACTION_REQUIRED), filter the head commit's checkSuites to `workflowRun.event == "pull_request"` (and the CI workflow name: `CI` in slang, `ci` in slangpy/slang-rhi). The repos also run `ClaudeCode - SlangPy/Slang-RHI Assistant` on `pull_request_review_comment`/`pull_request_review` events, and on fork PRs those suites sit at ACTION_REQUIRED even when the PR CI already ran. Counting any ACTION_REQUIRED suite inflated the 10-25 report: slangpy #787 (ci SUCCESS) and slang-rhi #899 (ci FAILURE) were listed as "CI never approved" (true counts 2 of 7 and 2 of 5, not 3 of 7 and 3 of 5). Corrected on 2026-10-26.

Second note from the same run: running 3-4 GraphQL scripts in parallel next to the sibling daily sweeps triggered GitHub's GraphQL *secondary* rate limit (HTTP 403 "exceeded a secondary rate limit") even with ~5700/6000 primary points left. A 10 s retry recovered. Run GraphQL scripts one at a time, and check that aliased batch queries return every alias (silent missing items otherwise).

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1793003118714-fork-pr-ci-never-approved-count-filter-checksuites.md`_
