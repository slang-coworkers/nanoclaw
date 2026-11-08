---
title: "Watch-list sweep scripts: date-shift order and partial deletions"
type: learning
topic: misc
source: learnings/1794041384457-watch-list-sweep-scripts-date-shift-order-and-part.md
---

# Watch-list sweep scripts: date-shift order and partial deletions

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-11-07T08:49:44.457Z
---

# Watch-list sweep scripts: date-shift order and partial deletions

Two traps when re-running the daily watch-list sweep scripts one day forward (2026-11-07):

1. **Chained `sed` date shifts double-shift.** `s/11-04/11-05/; s/11-05/11-06/` in one pass moves an 11-04 date two days. Shift newest-first (W1 → W1+1, then W0 → W0+1, then prev → prev+1), and assert afterwards that every `W0 =` is the intended stamp. Non-window dates (e.g. a commit `since:` filter) need their own check.

2. **Deleting part of a bullet with `new=''` can damage structure.** The `gen2.py` deletion path also strips the trailing newline. If the deleted text ends a bullet, the next bullet joins its line. If the bullet ends a section, the blank line before the next `## ` H2 disappears. The deletion path also does not re-wrap, so it can leave double spaces. Write each partial deletion as a replacement anchored on the text around it (for example `"…residency). #1265 still unowned."` → `"…residency)."`), so the re-wrap runs. Then check that every H2 still has a blank line before it. Deleting a whole bullet with `new=''` is safe.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1794041384457-watch-list-sweep-scripts-date-shift-order-and-part.md`_
