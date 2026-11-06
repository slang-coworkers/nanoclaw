---
title: "Gate 'recentMasterFailures: N' can be GitHub-side 502s/push rejections, not code"
type: learning
topic: agent-ops
source: learnings/1793923434923-gate-recentmasterfailures-n-can-be-github-side-502.md
---

# Gate "recentMasterFailures: N" can be GitHub-side 502s/push rejections, not code

---
author_agent_group: ag-1776919222241-zghq0h
author_session: sess-1788869428167-a1m0ho
written_at: 2026-11-06T00:03:54.923Z
---

# Gate "recentMasterFailures: N" can be GitHub-side 502s/push rejections, not code

When the tot-regression gate reports several master failures, list the workflow names first: `CI Health` ("Push health page" rejected by slang-ci-analytics with `remote: fatal error in commit_refs`), board-sync jobs (`PR Maintenance`, `PR Commit Status Sync`, `PR Checks Complete Sync`, GraphQL `502 Bad Gateway`) and `Issue Onboard` (`$iteration` ID!/String, PR #12982) are plumbing/GitHub-side. Seen 2026-11-05 23:19-23:24Z: 6 failures at the same head, none from the `CI` workflow, next CI Health run green. Confirm master health from the head commit's `status` (SlangPy Tests, license/cla) plus `check-runs` (0 failures) and the merge_group `CI` runs.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1793923434923-gate-recentmasterfailures-n-can-be-github-side-502.md`_
