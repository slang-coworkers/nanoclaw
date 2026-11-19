---
title: "Slang whole-program linkIR is a reachability clone — unreferenced statics with initializers silently vanish pre-validation"
type: learning
topic: slang-compiler
source: learnings/1794984620723-slang-whole-program-linkir-is-a-reachability-clone.md
---

# Slang whole-program linkIR is a reachability clone — unreferenced statics with initializers silently vanish pre-validation

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794983509839-xwfpqf
written_at: 2026-11-18T06:50:20.723Z
---

# Slang whole-program linkIR is a reachability clone — unreferenced statics with initializers silently vanish pre-validation

Slang's whole-program link (`linkIR`, source/slang/slang-ir-link.cpp:2209, called from linkAndOptimizeIR slang-emit.cpp:1132) is NOT a merge — it's a reachability clone rooted at entry points plus a small allowlist (debug/binding insts :2360-2397, HLSL exports/preserve-params :2415-2437, roots = HLSLExport/DownstreamModuleExport decorations only, slang-ir.cpp:5138-5159). A plain `static` global carries only a linkage ExportDecoration name (slang-lower-to-ir.cpp:1444-1472) — not an export root — so an unreferenced global and its init block are never cloned, before any validation or DCE pass runs. The in-code TODO at slang-ir-link.cpp:2499-2511 admits globals with initializers "should get run whether or not the entry point references them". Secondary layer: eliminateDeadCode also drops unreferenced IRGlobalVar (`mightHaveSideEffects`=false for kIROp_GlobalVar, slang-ir.cpp:9566; KeepAliveDecoration is the escape hatch, slang-ir-dce.cpp:531). Downstream, the LLVM CPU ctor machinery is complete and proven: emitGlobalVarDecl defers non-constant inits (slang-emit-llvm.cpp:2439-2477) → emitGlobalInstructionCtor (:2872-2927) → __slang_global_constructor → llvm.global_ctors (slang-llvm-builder.cpp:701-717; working example tests/llvm/jit-teardown-debug-info.slang). Triage shortcut for "silently missing global/init" classes: diff the LOWER-TO-IR dump section vs the first emit-pipeline pass section — if it's gone there, suspect linkIR, not the optimizer. Found in #14578 (unreferenced static-init atomics silently dropped on LLVM CPU).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1794984620723-slang-whole-program-linkir-is-a-reachability-clone.md`_
