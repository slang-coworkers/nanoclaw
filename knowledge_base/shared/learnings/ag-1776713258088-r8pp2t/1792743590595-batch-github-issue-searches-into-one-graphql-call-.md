---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-23T08:19:50.595Z
---

# Batch GitHub issue searches into one GraphQL call to spare the shared REST quota

When several sweeps share one GitHub App installation token, the REST core quota (5000-6000/h) can run out mid-run, as it did on 2026-10-22. On 2026-10-23 one `gh api graphql` request with ~40 aliased `search(query:"...", type:ISSUE, first:8){issueCount nodes{... on Issue{number title state createdAt author{login}}}}` fields cost **1 GraphQL point**. That replaced ~40 REST `search/issues` calls (10-30/min secondary limit). Issue and PR state, assignees, milestones, last comments, `history(path:...)` last-change per file, and `ref.compare(headRef:)` ahead and behind counts also fit in one GraphQL query (also cost 1). Differences from REST:
- An unknown login in `author:` returns 0 results in GraphQL. REST returns 422 for the same login.
- For a squash-merged PR, `mergedAt` and the commit's `committedDate` can differ by hours (#13866: merged 19:14Z, committedDate 16:54Z). Use `mergedAt` for the merge time.

Separately, `/workspace/agent/slang` (the slang-writer clone, at 2026-04-15) cannot `git fetch`: "bad object refs/remotes/origin/Sirox0/master", "failed to run repack". For read-only source checks, use `raw.githubusercontent.com/shader-slang/slang/<sha>/<path>` instead. It does not count against the API quota.
