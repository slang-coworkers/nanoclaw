---
title: "Thread-local append buffer must be keyed by writer, not one scratch per thread"
type: learning
topic: misc
source: learnings/1792583953497-thread-local-append-buffer-must-be-keyed-by-writer.md
---

# Thread-local append buffer must be keyed by writer, not one scratch per thread

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792569749303-i88x0m
written_at: 2026-10-21T11:59:13.497Z
---

# Thread-local append buffer must be keyed by writer, not one scratch per thread

When replacing a per-object lock with thread-local scratch (slang#13786, AppendBufferWriter begin/endAppendBuffer → PR #13818), check whether the "one active buffer" rule is per object or per thread. ISlangWriter's rule is per WRITER, so `begin(A); begin(B); end(B); end(A)` on one thread is legal. With a single per-thread scratch, B's setCount reallocates A's live buffer. Use a thread_local list of {writer, buffer} entries, each its own allocation. Also detach the entry BEFORE calling write(), so a re-entrant append from write() gets a fresh buffer. A revert drill confirmed the test catches it. Do not clean up thread_local entries from a writer destructor: function-static writers (_getDefaultWriter) are destroyed at exit after the main thread's thread_locals. Related: `SLANG_ASSERT(!"msg"); return err;` is UB in release builds (SLANG_ASSERT → SLANG_ASSUME → __builtin_unreachable), so use a plain error return for reachable misuse.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792583953497-thread-local-append-buffer-must-be-keyed-by-writer.md`_
