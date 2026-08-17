---
title: "Slang CUDA/OptiX varying-param legalizer: terminate-intrinsic detection + pre-pass timing"
type: learning
topic: slang-compiler
source: learnings/1781782798777-slang-cuda-optix-varying-param-legalizer-terminate.md
---

# Slang CUDA/OptiX varying-param legalizer: terminate-intrinsic detection + pre-pass timing

From slang#11658 fix (payload lost when AcceptHitAndEndSearch/IgnoreHit is in a nested callee). Reusable facts about `source/slang/slang-ir-legalize-varying-params.cpp` (CUDA ctx):

- **`emitPayloadWritebacks()` scans ONLY `m_entryPointFunc->getBlocks()`** and inserts the OptiX payload write-back before `Return` and before *direct* terminating-intrinsic calls. A terminating call buried in a callee is invisible to it → payload write-back stranded at the dead epilogue. The `[ForceInline]`/direct-in-entry forms work because the terminate ends up in the entry point's blocks.
- **`isShaderTerminatingIntrinsic` detects via NAME HINT for CUDA.** The `__target_switch` cuda case lowers to intrinsic-asm `optixIgnoreIntersection`/`optixTerminateRay`, which do NOT contain the substrings "IgnoreHit"/"AcceptHitAndEndSearch" — so the IRTargetIntrinsicDecoration-definition check fails and the function NAME HINT ("IgnoreHit"/"AcceptHitAndEndSearch") is what carries detection. Consequence: any analysis keyed on this must gate on ray-tracing stage, else a non-ray kernel calling a user func literally named IgnoreHit collides.
- **`processEntryPoint` caches `m_firstBlock`/`m_firstOrdinaryInst`/first+last params at its START (before `beginEntryPointImpl`).** Any pass that reshapes the entry point's IR (e.g. inlining callees) MUST run BEFORE `processModule` (a top-level pre-pass in `legalizeEntryPointVaryingParamsForCUDA`), NOT inside `beginEntryPointImpl` — otherwise those cached pointers go stale.
- **Recursion reaching a ray terminate intrinsic is rejected UPSTREAM by E55201 ("recursion not allowed")** before the CUDA legalizer runs. So a cyclic call subgraph never reaches this stage; cycle-detection guards here are defensive (prevent an inline-loop hang), not commonly hit — don't claim a recursion diagnostic "can't fire on previously-compiling code" as a non-breaking justification (codex flags it).
- **Prefer `inlineCall(call)` on the exact target call sites over marking `[ForceInline]` + `performForceInlining(func)`.** The latter (a) inlines ALL `[ForceInline]` callees reachable from func, not just yours, and (b) `canInline` does NOT guard recursion, so a `[ForceInline]` recursive callee makes `performForceInlining` loop forever. `inlineCall` is precise and avoids both.
- Verify CUDA-emit miscompiles statically with `slangc -target cuda -entry X -stage anyhit` (no GPU); grep emitted order of `optixSetPayload_N` vs `optixTerminateRay`/`optixIgnoreIntersection`. FileCheck SIMPLE test mirrors `tests/cuda/optix-ignore-hit.slang`.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781782798777-slang-cuda-optix-varying-param-legalizer-terminate.md`_
