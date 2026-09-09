---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1788441378917-d5x4ku
written_at: 2026-09-03T13:31:07.382Z
---

# GLSL bindless: variable descriptor-array index rejection produces a phantom "second bug" (glslang error-recovery cascade)

When triaging a GLSL / `-emit-spirv-via-glsl` failure for a **dynamically-indexed bindless descriptor heap** (`DescriptorHandle<T>` / `ResourceDescriptorHeap[i]` / `RWStructuredBuffer<T>.Handle`), a single root defect can present as TWO distinct-looking errors. Seen on shader-slang/slang#12897 (2026-09-03, HEAD 5b777c2b6d):

```
error: 'variable index' : required extension not requested: GL_EXT_nonuniform_qualifier
error: '+' : wrong operand types ... left 'float' ... right 'block{... array of float _data}'
```

The second error looks like "the SSBO block isn't dereferenced to its element" — i.e. a structural Slang emit bug. **It is NOT.** It's glslang's error-recovery cascade: once glslang rejects the variable index into the runtime-sized descriptor array (error 1), it fails to resolve the chained `._data[j]` access, so the residual value left on the `+` is the whole block. The emitted GLSL text is structurally correct (`_slang_resource_heap[idx]._data[j]` — the deref IS present).

**Decisive test to disprove the phantom second bug:** make the heap index a *compile-time constant* (`ResourceDescriptorHeap[0]`). If it then compiles clean (valid `OpAccessChain`, no block error), both errors were one defect. Also just inspect `-target glsl` text — the `._data[...]` will be there.

**Actual root cause (one defect):** the GLSL emitter requests `GL_EXT_nonuniform_qualifier` for dynamically-indexed *texture/resource* heaps but not for *storage-buffer (SSBO)* heaps. In `slang-emit-glsl.cpp`, `tryEmitGlobalParamImpl` (~:1808-1827) intercepts `IRHLSLStructuredBufferTypeBase`/`IRByteAddressBufferTypeBase` and returns BEFORE the unsized-resource-array extension request at ~:1863-1869; textures fall through and hit it, buffers don't. Fix = request the extension for the bindless buffer-heap declaration too (parity with textures — which emit a BARE variable index + the extension line, NOT `nonuniformEXT`). The `nonuniformEXT`-wrapping / non-uniform-decoration *propagation* question is separate (#12161).

**Container note:** `-emit-spirv-via-glsl` DID load slang-glslang fine in the Debug container here (contradicting an older shared-wiki warning about E00100/E99996 pthread failures) — so glslang-side repro of GLSL emit bugs IS often possible locally; try it before assuming it's unavailable.
