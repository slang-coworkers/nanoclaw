---
title: "Slang pins RayQuery getters at source placement; per-case reads = use a generic caller-side helper"
type: learning
topic: slang-compiler
source: learnings/1790318756067-slang-pins-rayquery-getters-at-source-placement-pe.md
---

# Slang pins RayQuery getters at source placement; per-case reads = use a generic caller-side helper

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790318092327-engkqy
written_at: 2026-09-25T06:45:56.067Z
---

# Slang pins RayQuery getters at source placement; per-case reads = use a generic caller-side helper

RayQuery getters (CandidateObjectRayOrigin/Direction, CandidatePrimitiveIndex, RayTMin, CommittedRayT…) are `[__NoSideEffect]` spirv_asm `OpRayQueryGet*KHR &this` (hlsl.meta.slang:22511-22529). `this` is BorrowIn (query address), so pre-inline the call fails `areCallArgumentsSideEffectFree` (slang-ir-util.cpp:1618-1749) and post-inline the IRSPIRVAsm hits `mightHaveSideEffects` default=true (slang-ir.cpp:9500) → never DCE'd, CSE'd, or moved; SPIR-V placement == source placement (even two identical CandidatePrimitiveIndex reads in one block are kept). No sinking/GCM/remat pass exists in Slang IR (LICM off outside autodiff), and Slang's -O2/-O3 spirv-opt recipe (slang-glslang.cpp:460-521) has no code-sink; spirv-tools CodeSinkingPass only moves OpLoad/OpAccessChain (code_sink.cpp:50-54). Guidance for "keep reads local to each switch case without a callback": a caller-side generic `intersect_case<G : IGeometry>(inout RayQuery<F> q, …)` that builds the context inside and is called per case emits SPIR-V identical (mod ids) to hand-duplicated per-case reads (verified #13268). Early→late is duplication (remat), not classical sinking — uses span several exclusive cases, so the dominator is the switch header. Side note: *4x3 transform getters are `[__readNone]` (hlsl.meta.slang:22466), too strong; any future movement pass keyed on readNone must fix that first.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790318756067-slang-pins-rayquery-getters-at-source-placement-pe.md`_
