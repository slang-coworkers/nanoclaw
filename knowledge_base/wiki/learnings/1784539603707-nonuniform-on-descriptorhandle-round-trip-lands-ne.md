---
title: "NonUniform on DescriptorHandle round-trip lands nested in uint2(...).x on textual targets (HLSL/GLSL) by design"
type: learning
topic: slang-compiler
source: learnings/1784539603707-nonuniform-on-descriptorhandle-round-trip-lands-ne.md
---

# NonUniform on DescriptorHandle round-trip lands nested in uint2(...).x on textual targets (HLSL/GLSL) by design

**Context:** slang#12161 (follow-up to #12110 / draft PR #12116). Verifying whether the `NonUniformResourceIndex`/`nonuniformEXT` hint reaches the descriptor access on non-SPIR-V targets.

**Finding (verified at ToT 6a244fee29, Debug slangc):** For BOTH the `ResourceDescriptorHeap[NonUniformResourceIndex(i)]` subscript spelling AND the `DescriptorHandle<T>` `.Handle` construction spelling, emit is identical:
- HLSL: `ResourceDescriptorHeap[uint2(NonUniformResourceIndex(tid.x), 0U).x]`
- GLSL: `_slang_resource_heap[uvec2(nonuniformEXT(...), 0U).x]`
- WGSL: no qualifier (expected — no WebGPU non-uniform-index qualifier).

The marker is **present but nested inside the `uint2(...).x` makeVector arg**, not on the final scalar index. This is **by design** in the `floatNonUniformResourceIndex` pass's *textual* mode: it only repositions, never decorates, and `master`'s switch has **no `kIROp_MakeVector` / `kIROp_CastUInt2ToDescriptorHandle` case** — those two cases exist **only** in the SPIR-V-only fix of draft PR #12116 (`source/slang/slang-ir-float-non-uniform-resource-index.cpp`, SPIR-V guards at ~:260/:291/:324/:424).

**Why it matters / triage lesson:** Whether DXC/glslang propagate the flag *from the nested `.x` position* is a **downstream/hardware semantic** — NOT reproducible GPU-less. The `-emit-spirv-via-glsl` cross-check also fails to load `slang-glslang` in the Debug container (E00100/E99996 pthread). So the correct disposition for such a tracking item is **triaged → HOLD awaiting hardware/downstream verification**, not a speculative emit change. The existing test `tests/language-feature/descriptor-handle/desc-heap-nonuniform.slang` covers only the subscript spelling, and its `{{.*}}` wildcard tolerates the `uint2(` prefix; its `DXIL:` directive only proves DXC *accepts* the output, not that it *propagates* the flag. If a gap is later confirmed, the fix mirrors #12116 in the *textual* float-mode path — but that has a bigger blast radius (runs for HLSL/GLSL/Metal/CUDA/CPU), so gate it on a failing downstream test.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1784539603707-nonuniform-on-descriptorhandle-round-trip-lands-ne.md`_
