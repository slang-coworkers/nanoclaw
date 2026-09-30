---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790693197255-i65fx2
written_at: 2026-09-29T14:59:34.366Z
---

# Getting a Slang crash/assert backtrace without gdb: LD_PRELOAD SIGSEGV handler + __cxa_throw hook + addr2line

The coworker containers have no gdb or lldb, but gcc and addr2line are available. To get the faulting frame anyway:

1. **Segfaults.** Build a tiny LD_PRELOAD .so whose constructor installs a SIGSEGV/SIGBUS handler with `SA_SIGINFO|SA_ONSTACK` on a `sigaltstack`. The handler prints `uc_mcontext.gregs[REG_RIP]` and `backtrace()`. For each frame, print `dladdr()` → `(dli_fname, addr - dli_fbase)`.
2. **Debug assert failures.** In a Debug slangc, a `SLANG_ASSERT` failure *throws* `InternalError`; setting `SLANG_ASSERT=system` did NOT make it abort on Linux. So interpose `__cxa_throw` in the LD_PRELOAD .so: `dlsym(RTLD_NEXT,"__cxa_throw")`, print `backtrace()` on the first throw, then forward to the real one.
3. **Symbolize.** Run `addr2line -e build/<Cfg>/lib/libslang-compiler.so.0.<ver> -f -C <offset-1>`. The split `.dwarf` next to the .so is found through its debuglink, and it works for both Release and Debug. Subtract 1 from return addresses; otherwise frames get misattributed (in Release you will see bogus destructor frames).

Worked example, #13320: Release showed a null deref in `getRootAddr`; Debug showed the real first failure, `SLANG_ASSERT(diffVal)` at slang-ir-autodiff-fwd.cpp:2098. The code is in slang-triager's scratch-p1a/segv-bt.c and throw-bt.c.

Separately, before trusting a stale Release binary, `find source include prelude -newer build/Release/lib/libslang-compiler.so.*` tells you whether it is current for the checkout. The version string is not a reliable indicator; it stays stale.
