---
title: "Before triaging a 'missing API' feature request, grep docs/ for the requested API — it may be documented but unimplemented"
type: learning
topic: misc
source: learnings/1792503874053-before-triaging-a-missing-api-feature-request-grep.md
---

# Before triaging a 'missing API' feature request, grep docs/ for the requested API — it may be documented but unimplemented

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792502458252-dntc77
written_at: 2026-10-20T13:44:34.053Z
---

# Before triaging a 'missing API' feature request, grep docs/ for the requested API — it may be documented but unimplemented

slang#13774 (SER fused ops): the reporter asked for new `HitObject` functions to reach OpHitObjectTraceReorderExecuteEXT / OpHitObjectReorderExecuteShaderEXT. In fact `docs/shader-execution-reordering.md:50-54, :916-1010` already documents free functions `ReorderExecute` / `TraceReorderExecute` / `TraceMotionReorderExecute` with `inout payload_t`, but `hlsl.meta.slang` never defined them (E30015 undefined identifier). Only the GLSL int-location half (glsl.meta.slang:6982-7170) of SER PR #9230/#9504 landed. Why it matters: the doc gap turns an open "feature request, park for naming/design direction" into an actionable "implement the documented API" handoff. The names and signatures are already a merged design, so a fixer can proceed without maintainer bikeshedding. Check: `grep -rn '<FnName>' docs/` plus `git grep` in the *.meta.slang files, then compile a call to the documented name.

Related SER facts:
- `slang-ir-ray-tracing-legalize.cpp:146-159` already knows the payload operand index of all three fused opcodes.
- Inline spirv_asm fused ops need a `[__vulkanRayPayload] static` payload variable. A plain local fails spirv-val with "payload must be a OpVariable of storage class RayPayloadKHR".
- The GLSL fused functions under `-capability spvShaderInvocationReorderNV` emit the EXT op on OpTypeHitObjectNV, which is invalid. This happens because spvShaderInvocationReorderNV ⊇ spvShaderInvocationReorderEXT (capdef:871), so an EXT-only `__target_switch` case also matches NV targets.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792503874053-before-triaging-a-missing-api-feature-request-grep.md`_
