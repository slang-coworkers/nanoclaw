---
title: "spvDescriptorHeapEXT unified-stride: per-type arrays + symbolic-max construct (#11718)"
type: learning
topic: misc
source: learnings/1782264945972-spvdescriptorheapext-unified-stride-per-type-array.md
---

# spvDescriptorHeapEXT unified-stride: per-type arrays + symbolic-max construct (#11718)

Design scoping for slang#11718 (unified resource-heap stride). Three non-obvious facts (HEAD f1142612a, `source/slang/slang-emit-spirv.cpp`):

**1. Emission architecture — corrects the "one heap array" mental model.** Slang emits a *distinct* `OpTypeRuntimeArray` **per descriptor element type**, cached on `(descriptorElementType, arrayStride)` (`getDescriptorRuntimeArrayType` :7186-7227). Each per-type array is passed as the **type operand of `OpUntypedAccessChainKHR`** (`:4964-4975` texel-ptr, `:7335-7343` descriptor load) — it is a *layout descriptor* (`ArrayStride` → `byteOffset = index×stride`), NOT a physical array variable. A buffer access and an image access into the SAME `heap` binding each use their OWN runtime-array type with their OWN `ArrayStride`. So "unified stride" = make EVERY non-AS/non-sampler per-type array advertise the SAME max stride — not a single-array edit. AS path (`:7266-7279`) and sampler heap are separate.

**2. Symbolic max of `OpConstantSizeOfEXT` — which SPIR-V construct.** `OpConstantSizeOfEXT` is device/impl-defined & opaque → max canNOT be folded at compile time, must be symbolic. `OpExtInst GLSL.std.450 UMax` is **INELIGIBLE**: its result is not a constant, so it can't live in constants/types nor be the operand of `OpDecorateArrayStrideIdEXT` (needs a constant `<id>`). Viable construct = `OpSpecConstantOp` chain: `max(a,b)=Select(UGreaterThan(a,b),a,b)`, folded pairwise. Both opcodes are already in Slang's working `OpSpecConstantOp` repertoire (`Select` @ :3763, `INotEqual` comparison @ :3782; emitter documents the allowlist at :3694-3696 — `OpBitcast` is NOT allowed). OPEN validator question: whether an opaque `OpConstantSizeOfEXT` result is an accepted *operand* of `OpSpecConstantOp` and whether the chain is accepted by `OpDecorateArrayStrideIdEXT` — needs spirv-val/maintainer confirmation. If "no", the feature isn't portably emittable (host-pinned literal stays the only path).

**3. Unified-max MUST be opt-in (don't redefine the stride-0 default).** Correct only when types genuinely share one physical heap. The opposite topology — *separate heaps, one per type* — packs each at `sizeof(thatType)`, where the current per-type auto stride is exactly right. Redefining `stride==0` to mean max() would over-stride those → mis-index the OTHER direction. So a new opt-in boolean (append `CompilerOptionName::SPIRVUnifiedDescriptorHeapStride = 153`, before `CountOf`; current tail `TraceCoverageBoolean = 152`) affecting only the `arrayStride==0` branch (:7199); explicit `-spirv-resource-heap-stride N` wins.

Standing test rule (reaffirmed): any descriptor-heap-of-X test must include a case that OMITS the stride flag to pin the `OpConstantSizeOfEXT` default path; binary spirv-val gated on the construct being validated.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782264945972-spvdescriptorheapext-unified-stride-per-type-array.md`_
