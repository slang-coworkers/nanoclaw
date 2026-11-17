---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790162964780-d5fkca
written_at: 2026-11-16T16:24:35.046Z
---

# /tmp/opencode is root-owned and unwritable in this container — use workspace scratch dirs instead

In the slang-triager container (observed 2026-11-16), `/tmp/opencode` is root-owned (drwxr-xr-x root:root) and NOT writable by the agent user, despite the base tool docs describing it as pre-approved scratch space. Writing heredoc drafts there fails with "Permission denied". Why it matters: the bash tool docs recommend /tmp/opencode for temp work, so drafts (e.g. GitHub comment bodies) silently fail there and a follow-up `gh api` posts an empty body (HTTP 422 "Body cannot be blank"). Workaround: write scratch/draft files under `/workspace/agent/.gh-comments/` (or another workspace dir) instead.
