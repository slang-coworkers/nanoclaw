---
title: "SPV_EXT_descriptor_heap: OpTypeBufferEXT and OpBufferPointerEXT storage classes are INDEPENDENT (no matching rule); DeepWiki wrong"
type: learning
topic: misc
source: learnings/1784939925118-spv-ext-descriptor-heap-optypebufferext-and-opbuff.md
---

# SPV_EXT_descriptor_heap: OpTypeBufferEXT and OpBufferPointerEXT storage classes are INDEPENDENT (no matching rule); DeepWiki wrong

**Rule:** In the published `SPV_EXT_descriptor_heap` spec (rev 1, 2025-09-08, Khronos SPIRV-Registry), `OpTypeBufferEXT` carries a storage-class operand (:223-224, "must be Uniform or StorageBuffer") and `OpBufferPointerEXT`'s **result pointer** carries a *separate* storage-class operand (:265, "must be Uniform or StorageBuffer"). **There is NO normative validity rule requiring the two to match.** The only place they coincide is the worked buffer-access example (:373-385, both StorageBuffer) — an example, not a VUID. The `NonWritable` allowance (:159, "result of OpBufferPointerEXT *with the StorageBuffer storage class*") explicitly contemplates the result being other than StorageBuffer, i.e. treats them as independent knobs.

**Why it matters (slang#12226):** Triage (via DeepWiki) claimed the two classes *must* match, which would have killed "Approach B" (Uniform descriptor + StorageBuffer data pointer) and forced the harder all-Uniform Approach A. The spec text refutes that — B is spec-legal. DeepWiki was confidently wrong here, consistent with the wiki's standing caution that DeepWiki reasons from symbol names and has been wrong on this exact SPIR-V subsystem before (DebugSource dedup, varying-location).

**Two independent operands = two independent concerns:**
- `OpTypeBufferEXT` class → feeds `OpConstantSizeOfEXT` (:238-244) → heap runtime-array `ArrayStrideIdEXT` (:375-380) → controls BOTH the *descriptor KIND* the driver fetches from the heap slot AND the per-slot indexing *stride*. The app binds a uniform-buffer descriptor (8B) for `ConstantBuffer<T>`, so this MUST be Uniform — ABI-forced, not a style choice. #12226's bug is #11647 flipping this to StorageBuffer for struct elements.
- `OpBufferPointerEXT`-result class → the *data-pointer addressing* class; StorageBuffer is needed for the pointer-type `ArrayStride` that logical-Uniform pointers lack (`getPointerArrayStrideValue`, slang-emit-spirv.cpp:2021-2023). This is the #11483/#11647 concern. My prior learning 1783384030612 ("StorageBuffer is the correct class") was about THIS operand — fully consistent, not contradicted.

**How to apply:** The remaining #12226 open question is no longer a spec matching rule but a *device-ABI* one: can a Uniform-descriptor heap slot legitimately yield a StorageBuffer-class *data* pointer on real drivers + bundled spirv-val? Confirm empirically (SLANG_RUN_SPIRV_VALIDATION=1) and with a driver/extension author before implementing B. Fetch the spec verbatim from `https://raw.githubusercontent.com/KhronosGroup/SPIRV-Registry/main/extensions/EXT/SPV_EXT_descriptor_heap.asciidoc` — don't trust DeepWiki for spec-level VUID questions.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1784939925118-spv-ext-descriptor-heap-optypebufferext-and-opbuff.md`_
