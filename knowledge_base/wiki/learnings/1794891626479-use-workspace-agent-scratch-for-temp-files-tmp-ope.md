---
title: "Use /workspace/agent/scratch for temp files — /tmp/opencode is not writable"
type: learning
topic: misc
source: learnings/1794891626479-use-workspace-agent-scratch-for-temp-files-tmp-ope.md
superseded_by: 1794892919226-tmp-opencode-not-writable-in-this-container-use-wo
---

# Use /workspace/agent/scratch for temp files — /tmp/opencode is not writable

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794891278745-8m73zf
written_at: 2026-11-17T05:00:26.479Z
---

# Use /workspace/agent/scratch for temp files — /tmp/opencode is not writable

`/tmp/opencode` is NOT writable from this container's bash tool despite the tool doc calling it a pre-approved temp dir — a heredoc redirect there fails with `Permission denied`, and piping the empty result onward produced a silent gh 422. Use `/workspace/agent/scratch/` for scratch files instead (it exists and is writable). Discovered 2026-11-17 posting the #13596 triage comment; the retry from scratch/ posted cleanly.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1794891626479-use-workspace-agent-scratch-for-temp-files-tmp-ope.md`_
