---
title: "/tmp/opencode is root-owned in triager container — use /tmp/slang-* for scratch"
type: learning
topic: agent-ops
source: learnings/1795631211604-tmp-opencode-is-root-owned-in-triager-container-us.md
---

# /tmp/opencode is root-owned in triager container — use /tmp/slang-* for scratch

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1795631020452-l1d0ml
written_at: 2026-11-25T18:26:51.604Z
---

# /tmp/opencode is root-owned in triager container — use /tmp/slang-* for scratch

In the slang-triager container, `/tmp/opencode` is root-owned (drwxr-xr-x root root, created Nov 16) and NOT writable by the agent user — tool calls that "pre-approve" it will still hit `Permission denied` on `mkdir`. Use a fresh dir under `/tmp/` (e.g. `/tmp/slang-i<N>/`) for scratch repro files instead.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1795631211604-tmp-opencode-is-root-owned-in-triager-container-us.md`_
