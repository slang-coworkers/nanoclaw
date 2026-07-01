---
title: "Descriptor-heap texture atomics: E41403 validator gap (#11506) is separate from format-Unknown spirv-val (#11130)"
type: learning
topic: slang-compiler
source: learnings/1780869756318-descriptor-heap-texture-atomics-e41403-validator-g.md
---

# Descriptor-heap texture atomics: E41403 validator gap (#11506) is separate from format-Unknown spirv-val (#11130)

When fixing atomics on `DescriptorHandle<RWTexture2D<...>>` under SPIR-V, there are **two independent defects** — don't conflate them:

1. **E41403 "invalid atomic destination"** (slang#11506): only fires under `-capability spvDescriptorHeapEXT`. Root cause: `processImageSubscript` (slang-ir-spirv-legalize.cpp:1357-1370) rewrites the `IRImageSubscript` atomic dest into `IRSPIRVLoadTexelPointerFromHeap` (AddressSpace::Image) AFTER atomic validation is deferred (slang-emit.cpp:1917-1921; runs at slang-ir-spirv-legalize.cpp:2789). `isValidAtomicDest` (slang-ir-validate.cpp) accepted `IRImageSubscript` but not the heap texel pointer. Fix = one line: `if (as<IRSPIRVLoadTexelPointerFromHeap>(dst)) return true;` after the IRImageSubscript case. (PR #11507.)

2. **spirv-val format-Unknown** (slang#11130): even after E41403 is gone, binary SPIRV fails validation — `Expected the Image Format ... R32ui ... OpUntypedImageTexelPointerEXT` (VUID-...-11416). The bindless image type carries format `Unknown`.

**The non-obvious part:** fixing #11506 is NOT end-to-end sufficient, and static analysis won't reveal it — you MUST compile with `SLANG_RUN_SPIRV_VALIDATION=1` to see the second failure. Measured: plain `RWTexture2D<uint>` infers **R32ui** (valid); `DescriptorHandle<RWTexture2D<uint>>` gets **Unknown** (invalid) **both WITH and WITHOUT** the capability → the uint→R32ui default inference simply doesn't reach bindless/descriptor-heap textures. `resolveTextureFormat` (slang-ir-resolve-texture-format.cpp) only propagates an *explicit* `[vk::image_format]` decoration on global params and doesn't reach bindless handles — consistent with #11130's reporter finding the attribute didn't carry through. The format surface is #11130 / #11499 / #11503, distinct from the atomic validator.

**Takeaway:** keep these scoped to separate PRs. For a #11506-style validator-only fix, write the regression test with `-skip-spirv-validation` + FileCheck the (format-agnostic) opcodes (`OpUntypedImageTexelPointerEXT`, `OpAtomicIAdd`) so it stays green once #11130 lands; disclose the #11130 limitation in the PR body.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1780869756318-descriptor-heap-texture-atomics-e41403-validator-g.md`_
