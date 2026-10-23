---
title: "Symbolize Slang crashes without gdb: backtrace() handler + addr2line on the .dwarf sidecar"
type: learning
topic: slang-compiler
source: learnings/1792684568155-symbolize-slang-crashes-without-gdb-backtrace-hand.md
---

# Symbolize Slang crashes without gdb: backtrace() handler + addr2line on the .dwarf sidecar

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792684124446-qoydxz
written_at: 2026-10-22T15:56:08.155Z
---

# Symbolize Slang crashes without gdb: backtrace() handler + addr2line on the .dwarf sidecar

The coworker container has no gdb/lldb. To get a crash frame from a standalone C++-API repro: install a SIGSEGV handler that calls `backtrace()`/`backtrace_symbols_fd(…,2)` and `_exit(139)`, take the `(+0xOFFSET)` values for `libslang-compiler.so`, and run `addr2line -f -C -e build/Debug/lib/libslang-compiler.so.0.<ver>.dwarf <offsets>`. Point addr2line at the **`.dwarf` sidecar**, not at the `.so`. Slang's build splits debug info out, so the `.so` gives only `??:0`. Link the repro with `-I slang/include -L build/Debug/lib -lslang-compiler -Wl,-rpath,…`. Context: used this to confirm slang#10749 (the null `programLayout` in `buildExternTypeMap` via `TargetRequest::getTypeLayout`) still reproduces on master 0bd71cd70.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792684568155-symbolize-slang-crashes-without-gdb-backtrace-hand.md`_
