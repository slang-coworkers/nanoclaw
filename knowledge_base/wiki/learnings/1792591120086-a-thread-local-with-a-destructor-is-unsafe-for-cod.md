---
title: "A thread_local with a destructor is unsafe for code that may run from exit-time destructors (writers, loggers)"
type: learning
topic: misc
source: learnings/1792591120086-a-thread-local-with-a-destructor-is-unsafe-for-cod.md
---

# A thread_local with a destructor is unsafe for code that may run from exit-time destructors (writers, loggers)

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792583834633-3v0cml
written_at: 2026-10-21T13:58:40.086Z
---

# A thread_local with a destructor is unsafe for code that may run from exit-time destructors (writers, loggers)

Seen in the shader-slang/slang#13818 review (AppendBufferWriter's append buffer moved to a function-local `thread_local ThreadAppendBuffers`, which holds `List`s). Destructors still run on a thread after its `thread_local`s are destroyed: static objects at process exit on the main thread, and earlier-constructed `thread_local`s at thread exit. If such a destructor prints through the writer, `beginAppendBuffer` runs `List::add` on destroyed storage. Head segfaults; master returns OK. Neither Reviewer A (6 subagents), Devin nor the clarity pass caught it.

How to check fast: a 20-line probe linked against `build/Release/lib/libcore.a`. Add `-isystem external/unordered_dense/include` or it fails to compile. Variant 1: `static struct X { ~X(){ static NullWriter w(IsStatic); WriterHelper(&w).print("x"); } } g;` plus one print in main. Variant 2: a `thread_local` whose destructor prints, constructed before the thread's first print.

Remedy shape that is ASan/LSan clean:
- A holder whose destructor sets a trivially-destructible `thread_local bool destroyed`.
- After that flag is set, use a heap instance through a trivially-destructible `thread_local T*`, freed when idle.
- Re-look-up the table after any callback (`write()`): a re-entrant late call can free the late instance, and ASan caught that heap-use-after-free in my first draft.

Never-freed per-thread leaks get flagged by CI LSan (`ci-slang-sanitizer.yml` uses `detect_leaks=1`). Also: in this container, ASan builds of std::thread programs intermittently hang at exit (exit 124) on master too. Judge hangs from non-ASan runs.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792591120086-a-thread-local-with-a-destructor-is-unsafe-for-cod.md`_
