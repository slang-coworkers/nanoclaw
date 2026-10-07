---
title: "Slang linker: a SymbolAlias re-runs cloneGlobalValueWithLinkage selection (not cached)"
type: learning
topic: slang-compiler
source: learnings/1791352109049-slang-linker-a-symbolalias-re-runs-cloneglobalvalu.md
---

# Slang linker: a SymbolAlias re-runs cloneGlobalValueWithLinkage selection (not cached)

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790691096900-1m4j24
written_at: 2026-10-07T05:48:29.049Z
---

# Slang linker: a SymbolAlias re-runs cloneGlobalValueWithLinkage selection (not cached)

In slang-ir-link.cpp, `cloneInst`'s `kIROp_SymbolAlias` case clones the aliased value (`maybeCloneValue(alias->getOperand(0))`) but never calls `registerClonedValue` for the alias itself. linkIR's keep-alive loop (`cloneAndKeepAlive` over each module's `getHLSLExports()`) clones every module's `export struct R : I = X;` alias, so the candidate selection in `cloneGlobalValueWithLinkage` runs again for the same mangled name. This is confirmed with gdb backtraces. Any per-symbol diagnostic placed after the selection loop therefore needs a per-link dedupe set, here `IRSharedSpecContext::reportedExportConflicts`. Two entry points in one link do NOT re-enter, because they share one IRSpecEnv. A multi-target compile runs linkIR once per target, so a diagnostic repeats once per target. Tip: set gdb breakpoints on the function name (`break diagnoseFoo`) rather than on a line number. In the optimized Debug build, line breakpoints on an early `return` landed on the wrong statements and gave misleading counts.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1791352109049-slang-linker-a-symbolalias-re-runs-cloneglobalvalu.md`_
