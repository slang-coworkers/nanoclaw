---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788442123367-aqekvl
written_at: 2026-09-03T14:17:58.995Z
---

# slang GLSL: bindless buffer heap misses GL_EXT_nonuniform_qualifier; texture heap masks it (slang#12897)

**Symptom:** A bindless storage-buffer descriptor heap (`RWStructuredBuffer<T>.Handle` / `DescriptorHandle<RWStructuredBuffer<T>>`) read with a **dynamic** heap index emits GLSL that glslang rejects on `-target glsl` / `-emit-spirv-via-glsl`: `error: 'variable index' : required extension not requested: GL_EXT_nonuniform_qualifier`, followed by a `'+' : wrong operand types ... block{... _data}` error. `-emit-spirv-directly` is unaffected.

**The second error is a red herring** — it is glslang's error-recovery cascade of the first. Once glslang rejects the variable index into the unsized array, it can't resolve the chained `._data[j]`, so the residual in the expression is the whole buffer block. The emit is structurally fine (`_slang_resource_heap[idx]._data[j]` is present). Decisive check: a **constant** heap index (`[0]`) compiles clean — only the variable index fails ⇒ one defect (missing extension), not two.

**Root cause:** `GLSLSourceEmitter::tryEmitGlobalParamImpl` (`source/slang/slang-emit-glsl.cpp`) requests `GL_EXT_nonuniform_qualifier` for any unsized resource array (`as<IRUnsizedArrayType>(varType) && isResourceType(unwrapArray(varType))`), but the request lived **after** the structured/byte-address/param-group/SSBO early-returns. Those buffer types call a dedicated emit helper and `return true`, so they skip the request. Textures/samplers match none of those, fall through, and reach it — which is why texture heaps already emit the extension.

**Masking gotcha (bit me in test design):** a shader that mixes a texture heap with a buffer heap compiles anyway — the texture path requests the extension file-wide and the buffer heap rides on it (`desc-heap-direct-index.slang` is exactly this and passes). To expose the buffer defect, the regression test MUST be **buffer-only** (no texture/sampler). Use `uniform RWStructuredBuffer<float>.Handle bindless;` to avoid the E39019 implicit-global-param warning.

**Fix (Approach A):** hoist that single existing extension-request block **above** the early-returns (one source of truth) — buffer heaps then request it just like textures. `isResourceType` is true for structured buffers (`IRBuiltinGenericType`), byte-address (`IRUntypedBufferResourceType`), and param groups/SSBO (`IRPointerLikeType`), so the hoist also (correctly) covers their unsized arrays. `_requireGLSLExtension` deduplicates and the directive flushes in `emitFrontMatterImpl`, so relocation adds nothing for the fall-through types. Do NOT add `nonuniformEXT(...)`-wrapping — the texture path emits a bare index; wrapping/decoration is separate (#12161/#12051).

**GPU-free test:** `//TEST:SIMPLE(filecheck=GLSL): -target glsl ...` asserting `#extension GL_EXT_nonuniform_qualifier : require`, plus `//TEST:SIMPLE(filecheck=GLSLSPV): -target spirv-asm ... -emit-spirv-via-glsl` asserting `OpAccessChain{{.*}}%_slang_resource_heap`. `-emit-spirv-via-glsl` loads slang-glslang fine in the Debug container and is an established CI directive (see desc-heap-direct-index.slang). PR: shader-slang/slang#12899.
