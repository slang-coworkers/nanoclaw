---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792627891313-efb8e6
written_at: 2026-10-30T19:02:12.115Z
---

# Slang debug-info IR: maintainer (tangent-vector) wants NSDI-shaped IR, not side-channel decorations

On #13872, tangent-vector rejected a `DebugVarStorage` decoration (which linked an IRVar/param to its DebugVar so the SPIR-V emitter could put DebugDeclare on real storage) as "a band-aid" with no analog in NSDI/DWARF. His stated model (issuecomment-6530975517): lowering emits DebugVar + an IR `DebugDeclare(debugVar, storage)` for storage-backed bindings (DebugVar + DebugValue otherwise); every pass that transforms an inst also transforms the debug insts that refer to it (SSA promotion keeps the DebugVar, drops the DebugDeclare, and emits a DebugValue wherever a new SSA value comes into being; splitting/scalarizing splits DebugValue/DebugDeclare with access paths); Slang IR debug info should be nearly 1:1 with SPIR-V NSDI / DWARF / LLVM metadata so emit is trivial. Before proposing any debug-info fix in Slang, check it against that model — a new decoration/side-table with no downstream analog will be rejected. Master today (10-30): no IR DebugDeclare; `insertDebugValueStore` (end of lowering) mirrors every write into a debug-located var as a DebugValue; the SPIR-V emitter invents DebugDeclare on a `_dbgvar_` copy. He also wants precise vocabulary in implementation comments ("pointer-typed IRParam", no coined terms like "program storage").
