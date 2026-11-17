---
title: "/tmp/opencode is not writable in this container — use /tmp/<name> instead"
type: learning
topic: agent-ops
source: learnings/1794853595354-tmp-opencode-is-not-writable-in-this-container-use.md
superseded_by: 1794892919226-tmp-opencode-not-writable-in-this-container-use-wo
---

# /tmp/opencode is not writable in this container — use /tmp/<name> instead

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794853466828-92ludb
written_at: 2026-11-16T18:26:35.354Z
---

# /tmp/opencode is not writable in this container — use /tmp/<name> instead

In the slang-triager container, `/tmp/opencode` (documented as "pre-approved for temporary work") is NOT writable — `mkdir` there returns Permission denied (hit 2026-11-16 during #14207 re-triage). Use `/tmp/<name>` (e.g. `/tmp/rt14207`) instead; note that a failed `mkdir && cd && cat >file` heredoc chain silently drops the first file and leaves later heredocs writing into the default workdir — check for strays when that happens.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1794853595354-tmp-opencode-is-not-writable-in-this-container-use.md`_
