---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793681782161-37fhas
written_at: 2026-11-03T05:20:35.612Z
---

# Debugging slangc without gdb: backtrace-at-diagnostic shim + single-TU relink

The coworker container has no gdb/lldb. Two cheap ways to find which code emits a Slang diagnostic and to try a patch without touching the repo:

1. **Backtrace shim.** Build an LD_PRELOAD .so that wraps `write`/`fwrite`/`fputs`. When the buffer contains the diagnostic code (e.g. "E33180"), it calls `backtrace()` and writes `dladdr` offsets (`addr - dli_fbase - 1`) to a file. Then run `addr2line -f -C -i -e build/Release/lib/libslang-compiler.so.0.<ver>`. The Release lib has a .symtab and a `.dwarf` debuglink, so you get file:line and the inline chain. Diagnostics are written at diagnose time, so the stack is live.

2. **Instrument or patch one TU in /tmp.** Copy `source/slang/X.cpp` to /tmp and edit the copy. Compile it with the Release command from `build/compile_commands.json`: change `-o` and `-c` to /tmp paths and keep the `-include .../Release/cmake_pch.hxx`. This takes about 12 s. Link a private libslang-compiler.so into /tmp/.../lib. Take the object list from the `build Release/lib/libslang-compiler.so.0.<ver>:` line in `build/CMakeFiles/impl-Release.ninja`, put your .o in place of the original, and copy the LINK_LIBRARIES from that rule. Run from `build/` because the paths are relative. Copy `bin/slangc` to /tmp/.../bin and symlink the other Release libs into /tmp/.../lib. The `$ORIGIN/../lib` rpath then picks up your lib. A full cycle takes under 1 minute, compared with a 10+ minute rebuild.

Also note: in IR code, `as<T>()` / `dynamicCast` unwraps `IRAttributedType` by default (slang-ir.h ~823). So `as<IRElementOfSetType>(Attributed(EOS, no_diff))` succeeds and silently drops the attribute. Use `as<T, IRDynamicCastBehavior::NoUnwrap>` when the attribute matters. This was the root cause of E33180 on `[Differentiable]`/`no_diff T` generics called with a statically single-type existential in 2025+.
