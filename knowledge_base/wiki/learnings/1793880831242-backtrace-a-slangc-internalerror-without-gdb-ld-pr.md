---
title: "Backtrace a slangc InternalError without gdb: LD_PRELOAD a __cxa_throw hook"
type: learning
topic: slang-compiler
source: learnings/1793880831242-backtrace-a-slangc-internalerror-without-gdb-ld-pr.md
---

# Backtrace a slangc InternalError without gdb: LD_PRELOAD a __cxa_throw hook

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793878706483-564dfd
written_at: 2026-11-05T12:13:51.242Z
---

# Backtrace a slangc InternalError without gdb: LD_PRELOAD a __cxa_throw hook

The coworker containers have no gdb or lldb. To find where a `SLANG_RELEASE_ASSERT` / E99997 is thrown, compile a 10-line shim that overrides `__cxa_throw`. On the first throw it calls `backtrace()` + `backtrace_symbols_fd(…, 2)`, then forwards to `dlsym(RTLD_NEXT, "__cxa_throw")`. Build it with `gcc -shared -fPIC -o hook.so hook.c -ldl`. Run `LD_PRELOAD=hook.so ./build/Debug/bin/slangc …`. Symbolize the `(+0xOFF)` offsets with `addr2line -f -C -i -e build/Debug/lib/libslang-compiler.so.<ver> 0xOFF`. A SIGSEGV variant works the same way: install a `sigaction` handler with `SA_ONSTACK` plus `sigaltstack` from a constructor. Copies are in /workspace/agent/scratch-14240/bt/ (slang-triager).

The #14240 trace also showed something that is easy to miss. A `-dump-ir` "AFTER specializeModule" section can print before an assert that is really thrown INSIDE specializeModule. Typeflow (`specializeDynamicInsts`) transcribes autodiff derivatives on demand via `TranslationContext::resolveInst` from `analyzeCall`, so the last dump header is not the failing pass. Use the backtrace.

Variadic + autodiff: `_getCalleeActualFuncType` (slang-ir-autodiff-fwd.cpp) calls the 3-arg `maybeExpandConcreteFuncTypePacks`, which REWRITES the callee's type. `as<IRTypePack>` sees through `Attributed(…, no_diff)`. Call args are flattened only (a) by SpecializationContext when the callee is an IRFunc, or (b) by typeflow `expandPacksInFunc` on contexts it has discovered. So a primal body that is differentiated before typeflow discovers it gets N+k params against N args.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793880831242-backtrace-a-slangc-internalerror-without-gdb-ld-pr.md`_
