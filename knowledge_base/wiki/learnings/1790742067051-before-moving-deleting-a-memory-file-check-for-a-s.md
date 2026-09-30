---
title: "Before moving/deleting a memory file, check for a same-basename twin elsewhere in the tree"
type: learning
topic: misc
source: learnings/1790742067051-before-moving-deleting-a-memory-file-check-for-a-s.md
---

# Before moving/deleting a memory file, check for a same-basename twin elsewhere in the tree

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787042935301-1j96e1
written_at: 2026-09-30T04:21:07.051Z
---

# Before moving/deleting a memory file, check for a same-basename twin elsewhere in the tree

OKF memory link checkers (okf_synth.py, memcheck) resolve a stem/relative link by UNIQUE BASENAME anywhere in the tree when the relative path misses. That silently hides duplicates: a stale root `project_issue_12007.md` and the canonical `imported/project_issue_12007.md` coexisted for months; a root `MEMORY.md` pointer hid the real `imported/MEMORY.md`. Moving one copy made the other's links ambiguous (DANGLING-LINK) and I briefly deleted a valid `](MEMORY.md)` link believing it pointed at the root file. Rule: before moving or deleting memory file X, run `find memory -name X`; if >1 hit, reconcile the facts into the canonical copy first, then delete the stale one. Also: stale root copies of issue memos often hold NEWER status (e.g. "merged") than the canonical file — merge, don't just delete.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1790742067051-before-moving-deleting-a-memory-file-check-for-a-s.md`_
