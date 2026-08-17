---
title: "Metal emits unbound array-of-device-pointer for uniform array-of-resource (slangpy#1079 candidate)"
type: learning
topic: slang-compiler
source: learnings/1785418004751-metal-emits-unbound-array-of-device-pointer-for-un.md
---

# Metal emits unbound array-of-device-pointer for uniform array-of-resource (slangpy#1079 candidate)

**Confirmed GPU-free at slang HEAD 7c58a326b (2026-07-30).** A Slang `uniform MyTensor tensors[4]` param, where `MyTensor` contains a `StructuredBuffer<float>`, lowers WRONG on Metal vs SPIR-V/CUDA (motivating case: slangpy `Tensor<float,1>[4]`, correct on VK+CUDA=100.0, wrong on Metal).

**The emission signature (read directly from `slangc -target metal` output — this is the tell):**
- The struct's `buf` field is REMOVED from `struct MyTensor_0` (leaves just `uint count`).
- The 4 element buffers are hoisted into ONE bare kernel parameter `array<float device*, int(4)> entryPointParams_tensors_buf` **that carries NO `[[buffer(N)]]` attribute** — while every sibling param has one (`output [[buffer(0)]]`, `entryPointParams [[buffer(1)]]`). An unbound array-of-device-pointer arg is the defect.
- Per-element **indexing is CORRECT** (`...tensors_buf[i]` survives). So the bug is BINDING SHAPE, not index-dropping/aliasing. (A subagent initially hypothesized "aliasing/dropped index" — reading the actual MSL disproved that. Lesson: verify load-bearing codegen claims against emitted text, not a subagent summary.)
- SPIR-V contrast: keeps one `OpTypeArray %StructuredBuffer 4` at Binding 1/DescriptorSet 0, per-element `OpAccessChain %arr %i` — a well-formed descriptor array. Vulkan supports arrays-of-buffers; **Metal does not support arrays of buffers as of v3.1** (DeepWiki-confirmed limitation).

**Candidate fix layer (unsettled):** the flattening comes from `slang-ir-explicit-global-context.cpp` (`introduceExplicitGlobalContext`). Open question for a fixer: emit N bindful `[[buffer(k)]]` pointers, vs route plain uniform array-of-resource through the Metal argument-buffer / `MetalParameterBlockElementTypeLoweringPolicy` / `wrapCBufferElementsForMetal` path so it gets a `constant ArgBuffer*` binding.

**Distinct from #10842** (bindless DescriptorHandle — compiler-emit DONE, gap is slang-rhi runtime): this is a NON-bindless uniform array where compiler-emit itself is wrong. Related umbrella, different root layer. #7606 (closed) = old crash, same shape.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785418004751-metal-emits-unbound-array-of-device-pointer-for-un.md`_
