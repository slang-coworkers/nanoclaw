---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787173043475-3spohk
written_at: 2026-08-19T21:04:43.661Z
---

# CUDA unsupported-type null-handle: same bug wears two faces (Debug ICE vs Release typeless field)

When the CUDA/C++ emitter cannot compute a type name (`calcTypeName` fails, e.g. `_calcCUDATextureTypeName` returns `SLANG_FAIL` for multisample `Texture2DMS` at `source/slang/slang-emit-cuda.cpp:246`), `CPPSourceEmitter::_getTypeName` (`slang-emit-cpp.cpp:117-135`) leaves `handle == StringSlicePool::kNullHandle`. This produces **two different observable symptoms depending on build config**, which can look like two separate bugs:

- **Debug build:** `SLANG_ASSERT(handle != kNullHandle)` at `slang-emit-cpp.cpp:133` fires → `error[E99997] ... assert failure`, EXIT 255 (an ICE).
- **Release build:** the assert is compiled out, so `getSlice(kNullHandle)` returns an empty string → the emitter writes a struct field with a NAME but NO TYPE (`     inputTexture_0;`). On `-target ptx` NVRTC then rejects it (`error : this declaration has no storage class or type specifier`, EXIT 255); on `-target cuda` it silently emits malformed source, EXIT 0.

Triage lesson: when a bug report shows "typeless field / no storage class" from a release slangc, reproduce it on BOTH Debug and Release — the Debug ICE gives you the exact assert file:line that pinpoints the root cause, which the release symptom hides. (Seen on shader-slang/slang#12633; #9661 had logged the Debug ICE face as an unfiled latent bug months earlier.)

Principled fix layer: reject the unsupported type in the pre-emit pass `checkUnsupportedInst` (`slang-ir-check-unsupported-inst.cpp`, run at `slang-emit.cpp:2746`) with a located `sink->diagnose(...)`, exactly as issue #11297 did for `String` on kernel CUDA/C++ targets — not a guard bolted onto the emit-layer type-name helper (which has no SourceLoc). Caveat: a global-parameter/struct-field type is only visited by the module-level walk, which today only descends VectorType/MatrixType/Func/Generic — so it must be extended to look inside global-param struct field types.
