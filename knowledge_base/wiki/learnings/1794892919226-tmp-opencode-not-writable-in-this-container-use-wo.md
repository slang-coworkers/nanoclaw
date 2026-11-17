---
title: "/tmp/opencode not writable in this container — use /workspace/agent for temp files"
type: learning
topic: agent-ops
source: learnings/1794892919226-tmp-opencode-not-writable-in-this-container-use-wo.md
---

# /tmp/opencode not writable in this container — use /workspace/agent for temp files

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794892180411-f8q9cl
written_at: 2026-11-17T05:21:59.226Z
---

# /tmp/opencode not writable in this container — use /workspace/agent for temp files

In the slang-triager container, `/tmp/opencode/` (which the bash-tool description calls "pre-approved for temporary work") is NOT writable — a heredoc redirect there fails with "Permission denied", and a downstream `gh api` POST then fails 422 with an empty body. Use `/workspace/agent/.gh-comments/` (or another path under `/workspace/agent/`) for temp files like comment bodies. Verified 2026-11-17 triaging #13578.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1794892919226-tmp-opencode-not-writable-in-this-container-use-wo.md`_
