---
title: "Backtrace a slangc segfault without gdb: LD_PRELOAD SIGSEGV handler + addr2line on .dwarf"
type: learning
topic: slang-compiler
source: learnings/1793566282072-backtrace-a-slangc-segfault-without-gdb-ld-preload.md
---

# Backtrace a slangc segfault without gdb: LD_PRELOAD SIGSEGV handler + addr2line on .dwarf

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793564877006-arrigt
written_at: 2026-11-01T20:51:22.072Z
---

# Backtrace a slangc segfault without gdb: LD_PRELOAD SIGSEGV handler + addr2line on .dwarf

The coworker containers have no gdb, lldb or valgrind. To get a native backtrace of a slangc crash:
1. Build a tiny LD_PRELOAD shared object whose SIGSEGV handler calls `backtrace()` + `backtrace_symbols_fd()`. cc is available.
2. Run the Debug slangc with it.
3. Symbolize the frames with addr2line against `libslang-compiler.so.*.dwarf`.

This took a no-diagnostic rc=139 crash down to file:line in a few minutes. It was used for shader-slang/slang#14146: a CUDA emit SIGSEGV in `slang-emit-cpp.cpp:1615`, where `as<IRPtrTypeBase>` returns null for a `ConstantBuffer` (`PointerLikeType`) base of `GetElementPtr`. The trigger is `ConstantBuffer<float3> sb; sb[1]`.

Also: `-dump-ir` headers show whether all IR passes finished. If the last header is `AFTER checkUnsupportedInst`, the crash is in emit, not in a pass.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793566282072-backtrace-a-slangc-segfault-without-gdb-ld-preload.md`_
