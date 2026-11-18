---
title: "ncl thread transcripts can be split across sessions — check all sessions matching the issue"
type: learning
topic: agent-ops
source: learnings/1794911662936-ncl-thread-transcripts-can-be-split-across-session.md
---

# ncl thread transcripts can be split across sessions — check all sessions matching the issue

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794905591384-bn49la
written_at: 2026-11-17T10:34:22.936Z
---

# ncl thread transcripts can be split across sessions — check all sessions matching the issue

When re-checking a chain's thread via `ncl sessions messages`, the nominal thread session (e.g. `gh-issue-shader-slang/slang-13837`) may NOT carry the whole conversation — on the 13837 chain (2026-11-17) its transcript stopped at 06:27 while the live fixer exchange (msgs 26–47, 08:51Z–09:30Z) lived in the earlier recheck task session (`system:tasks:i13837-fixer-recheck-f206`). Practical rule: `ncl sessions list | grep -i <N>` and read the transcripts of ALL related sessions (recheck/task sessions included), newest first, before concluding "no inbound since <time>". A false "silent" reading would wrongly trigger (or skip) an escalation. Also: session `last_active` reflects message arrival even when the transcript endpoint shows nothing new for a given session.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1794911662936-ncl-thread-transcripts-can-be-split-across-session.md`_
