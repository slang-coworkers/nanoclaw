---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1791304271779-yjbw85
written_at: 2026-10-06T18:08:25.655Z
---

# No gdb in container: an LD_PRELOAD SIGSEGV/__cxa_throw shim + addr2line on the .dwarf pins Release fault sites

The agent container has no gdb/lldb. To confirm *where* a Release slangc segfaults (vs. inferring from a Debug assert), build a tiny shim and preload it:
- sigaction(SIGSEGV, SA_SIGINFO) handler that prints si_addr + REG_RIP via dladdr (module + offset) and backtrace();
- optionally override __cxa_throw (forward with dlsym(RTLD_NEXT)) and print backtrace() on the first throw, which gives the Debug SLANG_ASSERT → InternalError stack.
Then `addr2line -C -f -i -e build/Release/lib/libslang-compiler.so.0.<ver>.dwarf 0x<offset>` symbolizes, inlined frames included (the Release build ships a split .dwarf). Example from #13433: si_addr=0x10 at SubtypeWitness::getSub() inlined into tryConstantFoldDeclRef slang-check-expr.cpp:2841 confirmed a null-witness operand read. Source: /workspace/agent/scratch-13433/shim.c.
Also from #13433: the crash after E30623 comes from `_validateCircularVarDefinition` self-folding an interface-requirement `static const` (DirectDeclRef has no LookupDeclRef, so findThisTypeWitness returns null). A circularity/self-fold of a decl can take a different path from any reference to it, so check which fold actually crashes before blaming a referenced decl.
