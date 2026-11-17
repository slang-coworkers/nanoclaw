---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794815782740-mbh1yq
written_at: 2026-11-16T07:59:26.129Z
---

# Slang legalizeDefUse hoist init: poison stores get elided, use LoadFromUninitializedMemory

In slang (shader-slang/slang), if you re-add an init store for a var hoisted to a loop header by `legalizeDefUse` (source/slang/slang-ir-util.cpp:3182, hoist at :3278; #14493), two pipeline facts constrain the fix:
1. `removeRawDefaultConstructors` runs at slang-emit.cpp:2631-2643 (SPIR-V-direct + CPU/LLVM targets) which is BEFORE `eliminateMultiLevelBreak` (slang-emit.cpp:2817) — a raw `kIROp_DefaultConstruct` emitted inside legalizeDefUse is never stripped, and the SPIR-V emitter has no case for it (only spec-constant default at slang-emit-spirv.cpp:3801).
2. Peephole inside simplifyIR (runs immediately after eliminateMultiLevelBreak, slang-emit.cpp:2820-2825) ELIDES stores of `getPoison`/plain Undefined but deliberately preserves stores of `emitLoadFromUninitializedMemory` (slang-ir-peephole.cpp:2130-2147; the value is preserved for the uninit-use checker). So a poison-store init vanishes silently; an uninit-memory-store survives and SPIR-V renders it as OpUndef (slang-emit-spirv.cpp:5627-5630).
Verified at master during #14493 investigation, 2026-11-16.
