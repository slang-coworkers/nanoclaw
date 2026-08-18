---
title: "[require] capability atom does NOT auto-emit OpCapability for spirv_asm builtin-loads — declare it inline"
type: learning
topic: slang-compiler
source: learnings/1782828754941-require-capability-atom-does-not-auto-emit-opcapab.md
---

# [require] capability atom does NOT auto-emit OpCapability for spirv_asm builtin-loads — declare it inline

From slang#11841 (HEAD 90b8e77ea). `RayCurrentTime()` emitted `BuiltIn CurrentRayTimeNV` but no `OpCapability RayTracingMotionBlurNV`, so spirv-val rejected the module (VUID-VkShaderModuleCreateInfo-pCode-08737).

**Mechanism (empirically confirmed):** a `[require(..., spv-bearing-atom)]` attribute on a stdlib intrinsic in hlsl.meta.slang gates *availability* (compile-time capability checking/propagation) but does NOT cause the SPIR-V emitter to emit `OpCapability` for an inline `spirv_asm { ... OpLoad builtin(XxxNV:..) }` builtin-load. The base ray-tracing cap (`RayTracingKHR`) you see in the output comes from the execution model, not from the `[require]` atom — don't be fooled into thinking `[require]` emitted it.

**The idiom (intended, pervasive):** declare the cap+ext explicitly INSIDE the spirv_asm block. In hlsl.meta.slang every motion-blur intrinsic does:
```
spirv_asm {
    OpCapability RayTracingMotionBlurNV;
    OpExtension "SPV_NV_ray_tracing_motion_blur";
    ... }
```
e.g. `hitObjectTraceRayMotionNV` (:19868-19870) and ~10 more (:23342, 23501, 23600, 25543, 25583, 25623, 25663, 25727). `RayCurrentTime` (:20373) was the lone outlier that forgot them → the bug. Fix = add the two lines; capdef atoms (`spvRayTracingMotionBlurNV : SPV_NV_ray_tracing_motion_blur`, capdef:822) are already correct.

**Triage discriminator:** when a builtin-load emits its BuiltIn decoration but spirv-val complains the cap is missing, FIRST check whether sibling intrinsics needing the same cap declare it explicitly in their spirv_asm block. If they do, the failing one is an outlier-omission (cheap A fix), NOT a capability-propagation bug. Reserve "fix the [require]→OpCapability propagation" (high blast radius) for when no sibling uses the explicit idiom — and note the maintainer position that Slang does NOT iterate/inject into spirv_asm as legalization (learning 1781974573249).

**Verify GPU-free:** `slangc test.slang -target spirv -stage closesthit -entry main -O0 -o out.spv`, then parse OpCapability words (opcode 17) from the raw .spv with a 10-line python struct script — no spirv-dis/glslang needed (those .so's often fail to load in the agent env). Builtin CurrentRayTimeNV=5334, Capability RayTracingMotionBlurNV=5341.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782828754941-require-capability-atom-does-not-auto-emit-opcapab.md`_
