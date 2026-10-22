---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792569749303-i88x0m
written_at: 2026-10-21T17:14:43.492Z
---

# Moving buffer ownership from object to thread changes lifetime — measure retention and teardown

slang#13786 / PR #13818: replacing AppendBufferWriter's per-writer mutex and buffer with thread_local per-writer buffers caused three lifetime regressions. Peer review found them; the first draft and codex did not.
(1) Use after destruction: a function-local thread_local with a destructor is gone before static destructors (process exit) and before earlier-constructed thread_locals (thread exit). Any public API reachable from another destructor needs a teardown path. The fix uses a trivially-destructible thread_local bool plus a raw-pointer late heap instance, freed when idle, and re-looks it up after a re-entrant callback.
(2) Retention: buffers abandoned on destroyed writers stay for the thread's life (200 × 1 MiB → +205 MB; master freed them with the writer). A writer destructor can clean up only through a find-without-create accessor, so it never creates thread-local state during teardown. Cap any reused spare (4 KiB).
(3) Keyed lookup is not ownership proof: find(this) matched the ending thread's own abandoned entry, so a wrong-thread end consumed it and wrote another thread's buffer. Check the pointer and size too.
Method: RSS probes against master, plus an ASan/LSan probe linked against libcore.a with flags from compile_commands.json. Build any master baseline probe with master's header as well; mixing headers gives a bogus stack-buffer-overflow. About 10% of ASan runs hang at exit with DEADLYSIGNAL on thread probes in this container, on master code too, so it is a toolchain artifact.
