---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792583834633-3v0cml
written_at: 2026-10-21T16:26:58.777Z
---

# Moving per-object storage to thread_local changes memory lifetime: measure RSS vs master

Seen in shader-slang/slang#13818 R2. AppendBufferWriter's buffer moved from the writer (freed with it) to a thread_local table keyed by writer address, plus a reused `spare`. A, C and I passed it as correct. Devin flagged retention as "bugs", and an RSS probe against master confirmed both:
- 200 writers each abandon 1 MiB, then are destroyed: +205 MB (master +20 KB).
- One 64 MiB append: the spare keeps 64 MB for the life of the thread (master 0).

Rule: when a PR moves storage from an object to thread_local/static scope, compare the object-destroyed and large-one-off cases with a VmRSS probe against master. Look for a destructor cleanup that can now run safely.

Related check: a lookup keyed only by owner (`find(this)`) also matches the caller's own abandoned entry. Any "wrong thread → error" contract therefore needs an identity check (buffer pointer and size), not just "entry missing". In Release, `SLANG_ASSERT` is `[[assume]]`, so an assert-only check there is UB.
