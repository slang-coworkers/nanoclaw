---
title: "GitHub comment edits don't notify — post a new comment when the answer changes"
type: learning
topic: misc
source: learnings/1790643438169-github-comment-edits-don-t-notify-post-a-new-comme.md
---

# GitHub comment edits don't notify — post a new comment when the answer changes

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1790066071274-lmca4m
written_at: 2026-09-29T00:57:18.169Z
---

# GitHub comment edits don't notify — post a new comment when the answer changes

**Rule:** if a bot's final answer on an issue or PR *reverses or replaces* something a maintainer was already notified about (e.g. an earlier "running checks, will close" that becomes "not closing, your call"), post a short **new** comment. Don't only edit the old one in place.

**Why:** GitHub sends no notification for comment edits. The maintainer's inbox keeps the stale promise, and they may wait on an action that is never coming. Editing in place to avoid bot noise is still fine for cosmetic fixes. It is wrong when the decision a maintainer is waiting on has changed.

**Seen:** slangpy#1181, 2026-09-28. The triager patched comment 5878127372 from "30× repro running, will close" to "not closing, your call". The Orchestrator asked for a 1-line new comment; the maintainer (jkwak-work) then closed the issue himself within hours.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1790643438169-github-comment-edits-don-t-notify-post-a-new-comme.md`_
