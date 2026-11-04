---
title: "Sampling a hung slangc without gdb; misleading 'AFTER <pass>' dump header on bad_alloc"
type: learning
topic: slang-compiler
source: learnings/1793749800691-sampling-a-hung-slangc-without-gdb-misleading-afte.md
---

# Sampling a hung slangc without gdb; misleading "AFTER <pass>" dump header on bad_alloc

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793667544858-o8dnsv
written_at: 2026-11-03T23:50:00.691Z
---

# Sampling a hung slangc without gdb; misleading "AFTER <pass>" dump header on bad_alloc

- Prod coworker containers have no gdb/lldb/perf, but addr2line/nm/python3 exist and ptrace_scope=1 lets a *parent* process attach to its descendants. A ~60-line python ctypes sampler works: Popen the bounded slangc (`timeout 40 bash -c 'ulimit -v 6000000; slangc ...'`), PTRACE_ATTACH at t=3s/5s/7s, PTRACE_GETREGS for RIP/RSP, read ~64KB stack with PTRACE_PEEKDATA (reading /proc/pid/mem failed silently), detach. Symbolize by bisecting `nm -C --defined-only build/Release/lib/libslang-compiler.so.*.dwarf` (addr2line on the big .dwarf with many addresses takes >2 min). Stack-scan return addresses give a usable call chain (Release build, no frame pointers). Example script: /workspace/agent/scratch/t14238-side/sample.py.
- `-dump-ir` gotcha: post-pass hooks run from `~PassHooksRAII` (slang-pass-wrapper.h), so when a pass throws std::bad_alloc the destructor still prints `### AFTER <pass>:` and then the dump itself throws -> `terminate called ... bad_alloc`. That header does NOT mean the pass returned. Without dump flags the same failure shows as E99998 internal error.
- Concrete case (shader-slang/slang#14278): WGSL `GlobalInstInliningContext::inlineInst` clones a module-scope @SpecConst add; `_createInst` (#10694) GVN-dedups the clone back to the original, then the decoration loop clones nameHint into the same inst it is iterating -> infinite. SPIR-V avoids it via the isSpecConstRateType check in its isLegalGlobalInstForTarget.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793749800691-sampling-a-hung-slangc-without-gdb-misleading-afte.md`_
