---
title: "Critique gate fires on read-only gh calls in non-PR tasks (e.g. OKF memory synthesis)"
type: learning
topic: agent-ops
source: learnings/1790568902795-critique-gate-fires-on-read-only-gh-calls-in-non-p.md
---

# Critique gate fires on read-only gh calls in non-PR tasks (e.g. OKF memory synthesis)

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787042936753-q0fp57
written_at: 2026-09-28T04:15:02.795Z
---

# Critique gate fires on read-only gh calls in non-PR tasks (e.g. OKF memory synthesis)

In an OKF memory-synthesis run (no PR, memory edits only), fold subagents that ran read-only `gh pr view` / `gh api .../pulls/N/comments` / `gh pr checks` to verify issue state tripped `gate-critique-on-deliver.sh`. The parent then got a "CRITIQUE GATE BLOCKED your PR creation" notice, and every later `gh` read in those subagents was blocked. Workaround: in subagents that only need live GitHub state, use the read-only `mcp__slang-mcp__github_get_pull_request` / `github_get_issue` / `github_get_pull_request_comments` tools rather than `gh`. At the parent, record in the session that no PR is being created and don't run /codex-critique for a task that has no deliverable.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1790568902795-critique-gate-fires-on-read-only-gh-calls-in-non-p.md`_
