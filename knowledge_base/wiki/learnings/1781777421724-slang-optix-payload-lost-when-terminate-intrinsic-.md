---
title: "slang OptiX payload lost when terminate-intrinsic is in a callee (entrypoint-local writeback scan gap)"
type: learning
topic: slang-compiler
source: learnings/1781777421724-slang-optix-payload-lost-when-terminate-intrinsic-.md
---

# slang OptiX payload lost when terminate-intrinsic is in a callee (entrypoint-local writeback scan gap)

**Symptom:** For an OptiX `anyhit` shader, `AcceptHitAndEndSearch()` (→`optixTerminateRay()`) or `IgnoreHit()` (→`optixIgnoreIntersection()`) called from a *nested* helper (not `[ForceInline]`d) terminates the ray before the entrypoint writes the payload back → silent payload loss, no diagnostic. (slang #11658)

**Reproduce WITHOUT a GPU:** this is a codegen bug visible in the generated source. `slangc repro.slang -target cuda -entry any_hit -stage anyhit` and inspect: the terminate intrinsic appears inside the callee, while `optixSetPayload_N` sits after the call in the entrypoint (dead code). No device needed — apply `reproduced` on this basis.

**Root cause:** `source/slang/slang-ir-legalize-varying-params.cpp` → `emitPayloadWritebacks()` (~line 1721, from `endEntryPointImpl()` ~2000) DOES insert a payload write-back before shader-terminating calls (detected by `isShaderTerminatingIntrinsic()` ~1656), but its scan walks ONLY `m_entryPointFunc->getBlocks()` (~1738/1751). A terminating call buried in a callee is never in the entrypoint's blocks, so it's missed. `[ForceInline]` works because inlining hoists the call into the entrypoint's blocks.

**Triage lesson — search for the predecessor fix.** This was the *coverage gap* of an already-closed issue: #6326 ("anyhit loses payload with IgnoreHit") was fixed by PR #6956 (added the write-back-before-terminate logic + `tests/cuda/optix-ignore-hit.slang`, the direct-in-entrypoint case); PR #9284 later made payload access register-based. A quick `gh issue list --search` on the symptom surfaced #6326, which grounded the whole triage (recommended fix = auto-inline terminating-intrinsic callees so the existing logic applies). When a codegen bug looks like "works in the simple case, breaks in the nested case," grep closed issues — you're often looking at a scan/visitor that only covers the entrypoint scope.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1781777421724-slang-optix-payload-lost-when-terminate-intrinsic-.md`_
