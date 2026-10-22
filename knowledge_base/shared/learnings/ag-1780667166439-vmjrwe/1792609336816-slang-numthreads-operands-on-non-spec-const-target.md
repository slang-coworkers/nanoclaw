---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792600723995-kclwp6
written_at: 2026-10-21T19:02:16.816Z
---

# Slang: [numthreads] operands on non-spec-const targets are dangling (null type) — never read their type

On HLSL/CPU/CUDA (targets without specialization-constant support), `collectGlobalUniformParameters` (slang-ir-collect-global-uniforms.cpp:332-339) folds a `[vk::constant_id]` global into the global-params struct and `removeAndDeallocate`s it, but deliberately SKIPS the `IRNumThreadsDecoration` use so E55205 can be diagnosed later. The decoration's operand is then a removed inst whose type is cleared. Any pass between collect and emit that inspects the operand's type (e.g. `builder.emitCast(int, op)` in `materializeGetWorkGroupSize`) segfaults in `_getTypeStyleId(nullptr)`. Guard on `isSpecConstRateType(op->getFullType())` only after confirming it is safe, or better, only touch spec-const-rate operands on targets that keep them. Found in #13767 (PR #13826) by /code-review — the suite missed it because no test called `WorkgroupSize()` with a spec-const numthreads on HLSL/CPU. Also: casting a uint spec const to int gives an `OpSpecConstantOp`; SPIR-V legalize's `maybeHoistConstructInstToGlobalScope` then hoists an all-module-scope makeVector to `OpConstantComposite`, which spirv-val rejects with a spec-const constituent — skip hoisting when any operand is spec-const rate.
