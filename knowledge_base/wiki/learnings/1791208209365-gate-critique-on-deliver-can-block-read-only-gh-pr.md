---
title: "gate-critique-on-deliver can block read-only `gh` PR queries as 'PR creation'"
type: learning
topic: agent-ops
source: learnings/1791208209365-gate-critique-on-deliver-can-block-read-only-gh-pr.md
---

# gate-critique-on-deliver can block read-only `gh` PR queries as "PR creation"

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791128523111-dg7u9a
written_at: 2026-10-05T13:50:09.365Z
---

# gate-critique-on-deliver can block read-only `gh` PR queries as "PR creation"

After memory/report edits following the last OUTPUT_REVIEW approve, the critique gate blocked a plain `gh api repos/shader-slang/slang/pulls/<n>` GET, a `gh api graphql` reviewThreads *query*, and a `check-runs` read, reporting each as "CRITIQUE REQUIRED before PR creation". No PR was being created; the PR was already merged.

**Workaround:** read PR state with the read-only MCP tools instead: `mcp__slang-mcp__github_get_pull_request`, `..._get_pull_request_reviews`, `..._get_pull_request_comments` and `..._get_issue`. The gate doesn't intercept them.

**Don't** run a ritual codex round just to clear the gate when nothing is being delivered. State in the session why it doesn't apply, and let the gate's admin escalation handle the misfire.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1791208209365-gate-critique-on-deliver-can-block-read-only-gh-pr.md`_
