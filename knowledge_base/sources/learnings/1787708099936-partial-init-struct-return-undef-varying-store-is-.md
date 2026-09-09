---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787691993339-eso1jz
written_at: 2026-08-26T01:34:59.936Z
---

# Partial-init struct return: undef varying store is fieldExtract(load(unpromoted var)), not IRUndefined

**Context:** slang#12756 — a vertex entry point returning an output struct with a never-written field (`o.uv`) emits a spurious SPIR-V/GLSL store of uninitialized data into that varying output.

**Non-obvious finding (verified via `slangc -dump-ir -target spirv-asm`):** The value reaching the bad store is NOT an `IRUndefined`. Because the local `o` mixes per-field address stores (`getFieldAddr(o,color)+store`) with a whole-struct `load(o)`, SSA/mem2reg does NOT promote it. So the final pre-emit IR is:
```
%o  = var                       // uv never stored
%42 = load(%o)
%44 = get_field(%42, uvKey)     // extract the never-written field
store(entryPointParam_uv, %44)  // the spurious store
```
The store value is `fieldExtract(load(var), key)`. A literal `as<IRUndefined>` guard (the tempting narrow fix, and the reason an `emitStore` OpUndef guard is INCOMPLETE) does NOT fire here. Only if SSA had folded the load would it become `LoadFromUninitializedMemory` (an `IRUndefined`). A fix must handle BOTH shapes.

**Root layer:** `slang-ir-glsl-legalize.cpp`. `legalizeEntryPointReturnValueForGLSL` creates a per-field varying-output global for EVERY field (unconditionally), then `rewriteReturnToOutputStore` does `assign(tuple-of-field-addrs, ScalarizedVal::value(returnValue))`, whose tuple loop emits an unconditional `fieldExtract`+store per field. Fix = skip the store in `assign`'s `Flavor::address ← Flavor::value` branch when the value is provably uninitialized. The output global is created independently, so the varying stays declared at its Location — only the garbage store disappears.

**Safety:** the uninit-use diagnostic (`checkForUsingUninitializedValues`) runs at front-end lowering (`slang-lower-to-ir.cpp`), long before this backend pass (`slang-emit.cpp`), so eliding the store cannot suppress a legitimate warning.

**Reuse:** `slang-ir-use-uninitialized-values.cpp` already has the per-field never-written idiom (`checkFieldsFromExit` + `isDirectlyWrittenTo` + `isUninitializedValue`) — mirror it, don't reinvent. Those helpers are file-`static` so not directly callable.

**Sibling #12653** (partial fragment output ARRAY → whole-array store, draft PR #12660) is the SAME family but a DIFFERENT site: an `out float4 result[8]` PARAMETER via `legalizeEntryPointParameterForGLSL` `assign(address←address)`. Neither fix subsumes the other; both live in `slang-ir-glsl-legalize.cpp` ~1800 lines apart, no conflict.
