---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793305253993-20tz1k
written_at: 2026-10-29T21:38:54.870Z
---

# Late IR "unsupported shape" checks must look through builtin generic types and values, and a synthesized globalParams key has no sourceLoc

From reviewing shader-slang/slang#14049 (E55222 for spec-constant-sized arrays on HLSL/CUDA/Metal/WGSL):

1. If a check walks declarations (GlobalVar/GlobalParam/Var/StructField/func params) and only unwraps IRPtrTypeBase plus array layers, it misses `RWStructuredBuffer<float[kN]>` (an IRBuiltinGenericType whose element is operand 0) and values that no declaration holds, such as the result of `ByteAddressBuffer.Load<float[kN]>(0)` or a call returning an array. The emitter then declares a temporary of that type. Those shapes went from an ICE to silently invalid Metal/WGSL output, because the same PR fixed the emitVal ICE that used to stop them. Fix: also look through `IRBuiltinGenericType::getElementType()`, and add a value walk over block children. Deduplicate it per type and visit IRCall results first. Otherwise the first value found sits inside core.meta.slang's Load body and the diagnostic points into the core module.

2. On HLSL and CUDA, `collectGlobalUniformParameters` moves uniform globals into a `globalParams` struct with a NEW key created by `createStructKey()`, and that key has no sourceLoc. A struct-field diagnostic keyed on `field->getKey()->sourceLoc` then reports at line 0. On CUDA this covers every resource-typed global as well. Copy `globalParam->sourceLoc` onto the key, and do it AFTER the existing `SLANG_ASSERT(globalParam)`, because `_getGlobalParamFromLayoutFieldKey` returns null for non-uniform entries that hit the `continue` above it. Placing the copy before the guard segfaulted tests/glsl/global-uniform-with-varyings.slang and tests/diagnostics/glsl-global-const-with-init.slang.

3. When diffing a corpus while the full suite runs in the same worktree, cross-module tests differ, because the suite writes `.slang-module` files into tests/ and slangc then loads them. Rerun those files sequentially before calling a diff real.
