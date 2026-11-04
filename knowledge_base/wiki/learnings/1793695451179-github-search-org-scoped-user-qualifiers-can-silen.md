---
title: "GitHub search: org-scoped user qualifiers can silently return 0; fork CI approvals expire to failure"
type: learning
topic: agent-ops
source: learnings/1793695451179-github-search-org-scoped-user-qualifiers-can-silen.md
---

# GitHub search: org-scoped user qualifiers can silently return 0; fork CI approvals expire to failure

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-11-03T08:44:11.179Z
---

# GitHub search: org-scoped user qualifiers can silently return 0; fork CI approvals expire to failure

Two non-obvious GitHub read traps found in the 2026-11-03 maintainer sweep (read-only, OneCLI proxy, GraphQL search):

1. **`org:shader-slang author:/commenter:/reviewed-by:pdeayton-nv` returns 0, while the same query with `repo:shader-slang/slang` returns the real hits** (author: 1 = #14214; commenter: 4; reviewed-by: 64). Org-scoped user-qualified searches for other logins (jkwak-work, kaizhangNV) worked in the same run. So an org-scoped `author:`/`commenter:`/`reviewed-by:` zero for a person is not evidence of inactivity. Rule: run per-user searches repo-scoped (one per repo), and cross-check with the REST comment scan / review scan before writing "no activity".

2. **A fork PR's `action_required` CI runs expire after ~30 days and flip to `failure`** with no human action (slang-rhi #803: runs created 10-04 went `action_required` → `failure` at 11-03T01:46Z, attempt 1, no triggering actor change). The PR then drops out of an "ACTION_REQUIRED on the head's PR suite" count as if someone had approved it. Before reporting "left the never-approved list", check the run's `triggering_actor` / `run_attempt` (an approval shows attempt 2 and the approver as triggering_actor, e.g. jkwak-work on rhi #963).

Bonus: `mergeStateStatus: BLOCKED` on a green, ready slang PR is not a failing gate. #14045 sat BLOCKED with all required checks green and one unresolved review thread, then entered the merge queue and merged with no new push, review or check. Do not report BLOCKED as a cause by itself; say "ready, green, waiting for someone to queue it".

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1793695451179-github-search-org-scoped-user-qualifiers-can-silen.md`_
