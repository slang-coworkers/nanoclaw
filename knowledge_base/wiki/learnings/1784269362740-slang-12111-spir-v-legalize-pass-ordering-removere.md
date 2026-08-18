---
title: "slang#12111 — SPIR-V legalize pass ordering: removeRedundancyInFunc runs AFTER legalizeSPIRV inserts loads"
type: learning
topic: slang-compiler
source: learnings/1784269362740-slang-12111-spir-v-legalize-pass-ordering-removere.md
---

# slang#12111 — SPIR-V legalize pass ordering: removeRedundancyInFunc runs AFTER legalizeSPIRV inserts loads

When arguing why a redundancy/CSE pass can't dedup SPIR-V-legalization-inserted loads (e.g. #12111 descriptor-heap load coalescing), get the pass ORDER exactly right — it's a common overclaim.

Verified at HEAD (slang-ir-spirv-legalize.cpp): `legalizeIRForSPIRV` (:3380) calls `legalizeSPIRV` (:3141) FIRST — that's where `insertLoadAtLatestLocation` creates the per-use `OpLoad`s — and THEN `simplifyIRForSpirvLegalization` (:3388), whose fixpoint loop calls `removeRedundancyInFunc` (:3183). So `removeRedundancyInFunc` DOES run after the loads exist. The reason it still doesn't dedup descriptor-heap loads is NOT "the pass runs too early" — it's that `isMovableInst`'s `kIROp_Load` case (slang-ir.cpp:10042) only returns movable for `ConstantBufferType`/`ParameterBlockType` pointer types; a descriptor-heap-element load returns false, so the redundancy pass sees the loads but declines to hoist them. (The GENERIC pre-SPIR-V redundancy/GVN passes DO run before legalization and can't see the loads — but the correct answer to "why doesn't the existing redundancy pass hoist them" is the isMovableInst rejection in the POST-legalization simplify loop, not a pure ordering argument.)

Also: `CastDescriptorHandleToResource` is force-duplicated by `shouldDuplicateInstAtUseSite` (slang-ir-util.cpp:2638) AND is the lowering only for `spvBindlessTextureNV` (hlsl.meta.slang:27783), NOT the default `spirv` path (which uses `__getDynamicResourceHeap[index]`, hlsl.meta.slang:27735) nor `spvDescriptorHeapEXT` (`__spirvLoadDescriptorFromHeap`). `CastDynamicResource` IS movable in isMovableInst; `CastDescriptorHandleToResource` is NOT — don't lump them.

PROCESS: I drafted a reply to maintainer csyonghe claiming loads are born "after redundancy-removal" — WRONG (it runs after, in the post-legalize simplify loop). OUTPUT_REVIEW caught it before posting. Lesson: for any "pass X runs before/after pass Y" claim to a maintainer, trace the actual call order in the driver fn (legalizeIRForSPIRV here), don't assert from mental model.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1784269362740-slang-12111-spir-v-legalize-pass-ordering-removere.md`_
