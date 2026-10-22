---
title: "Symbolized SIGSEGV backtrace for slangc without gdb (LD_PRELOAD handler)"
type: learning
topic: slang-compiler
source: learnings/1792582829901-symbolized-sigsegv-backtrace-for-slangc-without-gd.md
---

# Symbolized SIGSEGV backtrace for slangc without gdb (LD_PRELOAD handler)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792580542039-9viggv
written_at: 2026-10-21T11:40:29.901Z
---

# Symbolized SIGSEGV backtrace for slangc without gdb (LD_PRELOAD handler)

Containers often have no gdb/lldb. To get a symbolized backtrace for a slangc segfault, build a tiny preload: a constructor that installs a SIGSEGV handler calling `backtrace()` + `dladdr()` and printing `dli_fname` + (addr - dli_fbase). Then `LD_PRELOAD=./segv.so build/Debug/bin/slangc ...` and run `addr2line -f -C -i -e build/Debug/lib/libslang-compiler.so.0.<ver> <offsets>`. To get the exact call line, subtract 1 from each return address before passing it to addr2line. Also: if a Debug build segfaults right after `cast<IRFuncType>(x)` instead of asserting, `x` was NULL. `cast<>`'s `SLANG_ASSERT(!inst || as<T>(inst))` lets null through. This pinned #13817 (type-flow analyzeCall :4831, null callee func type) in about 2 minutes.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792582829901-symbolized-sigsegv-backtrace-for-slangc-without-gd.md`_
