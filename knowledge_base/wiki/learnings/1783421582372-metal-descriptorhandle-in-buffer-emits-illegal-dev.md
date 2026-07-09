---
title: "Metal DescriptorHandle-in-buffer emits illegal device T* device* (11970) — an existing pass already owns the shape but its filter misses it"
type: learning
topic: slang-compiler
source: learnings/1783421582372-metal-descriptorhandle-in-buffer-emits-illegal-dev.md
---

# Metal DescriptorHandle-in-buffer emits illegal device T* device* (11970) — an existing pass already owns the shape but its filter misses it

shader-slang/slang#11970. On `-target metal`, `StructuredBuffer<DescriptorHandle<StructuredBuffer<uint>>>` emits the illegal MSL `uint device* device* p [[buffer(0)]]` (and the texture sibling `texture2d<…> device* [[buffer(1)]]`), which Apple's compiler rejects for `[[buffer]]`.

Root cause (verified at HEAD e39e3ce03): Metal's `isResourceTypeBindless` **always returns true** (slang-emit-metal.h:28). So in slang-emit-c-like.cpp:444-449 a `DescriptorHandle<R>` buffer *element* emits `R` directly (`uint device*` / `texture2d<…>`), and the outer `StructuredBuffer` binding appends another `device*` (slang-emit-metal.cpp:1431-1436) → `device T* device*`.

Key triage insight: there is ALREADY a pass that owns exactly this shape — `MetalPointerBufferElementTypeLoweringPolicy` in slang-ir-lower-buffer-element-type.cpp:3318. Its comments (:3305-3312, :3390-3396) literally say *"the buffer binding is device*, so any T* element becomes device T* device* which Metal rejects → lower it (to UIntPtr)."* But its discovery filter `needsElementLowering` (:3346-3366) recurses only into `IRPtrType`/array/struct and does NOT match `IRDescriptorHandleType` or a bare resource type, so it never fires for the descriptor element. That gap is the precise fix layer.

Two fix shapes: (A) extend that filter to lower the descriptor buffer-element to UIntPtr — small, but CANNOT handle the texture sub-case (a texture handle isn't an integer address). (B, recommended, = reporter's suggestion) wrap the element in a 1-member struct (spvDescriptor / argument-buffer-tier-2 style; ABI byte-identical to today; textures already emit legally as struct members — confirmed via a ParameterBlock repro). B covers both buffer & texture uniformly.

Separately, arrays-of-resources on Metal (Variant 1 unsized → C99 flexible array member; Variant 2 fixed `array<T,N>` kernel param with no [[buffer]]) are a genuine FEATURE GAP: Metal has no native array-of-buffers/textures through MSL 3.1+ (DeepWiki-confirmed). Slang emits the array verbatim with no legalization. That belongs with the umbrella issue #10842; near-term the compiler should diagnose rather than emit invalid MSL. Don't conflate the tractable descriptor fix with the arrays feature.

Repro is GPU-free: `slangc -target metal` text emission reproduces all three variants exactly; `-target metallib` in a FileCheck test proves Apple's compiler accepts the fix. The existing tests/metal/entry-point-descriptor-handle-buffer.slang only covers a SINGLE `.Handle` param, not the array-of-descriptor shape.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1783421582372-metal-descriptorhandle-in-buffer-emits-illegal-dev.md`_
