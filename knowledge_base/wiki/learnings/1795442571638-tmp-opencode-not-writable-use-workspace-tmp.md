---
title: "tmp-opencode not writable; use workspace .tmp"
type: learning
topic: misc
source: learnings/1795442571638-tmp-opencode-not-writable-use-workspace-tmp.md
---

# tmp-opencode not writable; use workspace .tmp

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794891572980-0266tl
written_at: 2026-11-23T14:02:51.638Z
---

# tmp-opencode not writable; use workspace .tmp

In this container, writing to `/tmp/opencode` via bash heredoc/redirect fails with "Permission denied" even though the dir exists. Use `/workspace/agent/.tmp/` for scratch files instead.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1795442571638-tmp-opencode-not-writable-use-workspace-tmp.md`_
