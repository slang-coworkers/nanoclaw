---
title: "SPIR-V DebugFunctionDefinition dropped when a callee is inlined (emitDebugFunction record/definition cache conflation)"
type: learning
topic: slang-compiler
source: learnings/1790151769234-spir-v-debugfunctiondefinition-dropped-when-a-call.md
---

# SPIR-V DebugFunctionDefinition dropped when a callee is inlined (emitDebugFunction record/definition cache conflation)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790150189869-jnea1a
written_at: 2026-09-23T08:22:49.234Z
---

# SPIR-V DebugFunctionDefinition dropped when a callee is inlined (emitDebugFunction record/definition cache conflation)

shader-slang/slang#13235 (regression from PR #13175 "Restore caller debug scopes after inlining", f3a7ce5b0). At -g2/-g3 -O0, a function that has a callee inlined into it emits a `DebugFunction` record but NO `DebugFunctionDefinition` (the ExtInst in the first block that binds the DebugFunction to the OpFunction). The reporter saw it on a compute entry point, but it is NOT entry-point-specific — the trigger is "a function with an inlined callee" (removing the `[ForceInline]` callee restores the definition; a non-entry caller is equally affected).

Root cause (all source/slang/slang-emit-spirv.cpp unless noted):
- `emitDebugFunction` (:10673) conflates two SPIR-V insts with DIFFERENT lifetimes under one memoization: the once-per-`IRDebugFunction` `DebugFunction` RECORD, and the once-per-`OpFunction`-body `DebugFunctionDefinition` (:10730, gated `if(firstBlock && spvFunc)` :10728). The early-return at :10681-10684 (record already in `m_mapIRInstToSpvInst`) swallows the definition emit.
- #13175 inserts caller-scope-restore `DebugScope(<caller's own DebugFunction>)` insts into a function that received an inline (`emitCalleeDebugInlinedAt`, slang-ir-inline.cpp:377-378). In `emitFuncDefinition` the first-block DebugVar backing-declaration loop (:4308-4325) runs BEFORE the per-function debug emit (:4332); a DebugVar following one of those restore-scopes makes `findDebugScope` (:621) call `ensureInst(callerDebugFunc)`, which emits the DebugFunction BARE via the global path `processDebugGlobalInst` (:2403 / :4924, firstBlock=nullptr → no definition) and caches the record. The :4332 call then hits the :10681 early-return and skips the DebugFunctionDefinition. A function with no inlined callee has no preceding DebugScope inst → nothing pre-caches → :4332 emits both.

Fix layer: emit CONSUMER, not the producer — the restore-scope DebugScope IR is correct/needed. Decouple the once-per-OpFunction definition from the record cache (emit the definition even on a record cache-hit when firstBlock/spvFunc are real; track "definition emitted for this OpFunction" separately). Reordering :4332 before the DebugVar loop is fragile and misplaces the required OpVariables (correct order: OpVariables → DebugFunctionDefinition → DebugScope → DebugLine).

Note: NonSemantic.Shader.DebugInfo is NOT checked by spirv-val, so this ships silently (rc=0); only a GPU debugger (RenderDoc/Nsight) notices it can't map the OpFunction to its DebugFunction. This DebugFunctionDefinition-missing symptom has recurred before via other triggers (#9806 __include, fixed PR #9986).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790151769234-spir-v-debugfunctiondefinition-dropped-when-a-call.md`_
