---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787690720099-vsynjh
written_at: 2026-08-31T08:53:03.343Z
---

# SPIR-V storage capability subsumption must be enforced at the single insertion point, not across arms

Fixing shader-slang/slang#9910 (RWStructuredBuffer<uint8_t> emitting the broad `UniformAndStorageBuffer8BitAccess` cap instead of narrow `StorageBuffer8BitAccess`) surfaced two non-obvious things:

**1. Cross-"arm" subsumption is order-fragile; centralize it.** `requireCapabilitiesForType` in `slang-emit-spirv.cpp` is called once per *pointer-type emission*, lazily, so its `Uniform` and `StorageBuffer` arms fire in an order driven by which access is emitted first — NOT source/declaration order. An initial fix that enforced narrow/broad subsumption by having the two arms coordinate (uniform arm removes narrow; storage arm's phase-1 guard skips when broad present) empirically leaked BOTH capabilities when the same struct is bound through a ConstantBuffer AND a RWStructuredBuffer and the uniform access is emitted first. The robust fix: enforce the invariant at the ONE function every capability funnels through, `requireSPIRVCapability` — skip a narrow request when its broad superset is already present, and retract the subsumed narrow when adding the broad. Order-independent, single source of truth. Encode the narrow↔broad pairing in one helper (`getStorageBufferCapabilityPair` returning `{narrow, broad}`), not two mirror-image functions.

**2. The narrow `StorageBuffer{8,16}BitAccess` cap ALSO covers legacy SSBOs (Uniform + BufferBlock).** Per `external/spirv-tools/source/val/validate_memory.cpp`, a `Uniform`-storage-class variable with an 8/16-bit type is valid with the narrow cap IFF its type is `BufferBlock`-decorated (legacy SSBO); only a `Block`-decorated UBO needs the broad cap. So do NOT assume "Uniform class ⇒ broad cap": at SPIR-V 1.3 a RWStructuredBuffer lowers to `Uniform`+`BufferBlock` and the narrow cap suffices. A test asserting broad for a 1.3 RWStructuredBuffer asserts a non-minimal over-requirement. (Distinguishing UBO from legacy SSBO at the capability site is hard: the 8/16-bit element type reaching `requireCapabilitiesForType` doesn't carry the outer buffer's BufferBlock decoration.)

**3. Latent linked-list bug:** `SpvInstParent::addInst` did not set `parent` on a section's FIRST child (only the subsequent-child path did). Any capability removal (`removeFromParent`) of/near a first child then silent-no-op'd or tripped `SLANG_ASSERT(pp->parent == oldParent)`. Fixed at the producer.

Also: incremental `cmake --build --target slangc` sometimes relinks slangc against a STALE object (fix present in source but not the running binary). If a debug print / behavior change doesn't show up, `touch` the .cpp and rebuild, and verify the binary (mtime + a probe) before trusting results.
