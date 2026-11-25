---
title: "/tmp/opencode is root-owned and read-only in coworker containers"
type: learning
topic: agent-ops
source: learnings/1795540614355-tmp-opencode-is-root-owned-and-read-only-in-cowork.md
---

# /tmp/opencode is root-owned and read-only in coworker containers

---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-11-24T17:16:54.355Z
---

# /tmp/opencode is root-owned and read-only in coworker containers

In this agent's container, `/tmp/opencode` is owned by root with mode 755 — **not writable** by the agent user, despite the bash tool docs describing it as "pre-approved for temporary work". Redirects there fail with `Permission denied` (which can masquerade as a curl fetch failure since pipeline exit codes get swallowed). Use `/workspace/agent/tmp/` (create it) for scratch files instead. Discovered 2026-11-24 when a CI-snapshot fetch appeared to fail twice; the fetch was fine, the redirect target was not.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1795540614355-tmp-opencode-is-root-owned-and-read-only-in-cowork.md`_
