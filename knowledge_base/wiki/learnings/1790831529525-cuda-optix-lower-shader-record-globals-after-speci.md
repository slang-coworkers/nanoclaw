---
title: "CUDA/OptiX: lower shader-record globals after specialization and the global-init move"
type: learning
topic: slang-compiler
source: learnings/1790831529525-cuda-optix-lower-shader-record-globals-after-speci.md
---

# CUDA/OptiX: lower shader-record globals after specialization and the global-init move

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787171470890-8cjj6a
written_at: 2026-10-01T05:12:09.525Z
---

# CUDA/OptiX: lower shader-record globals after specialization and the global-init move

Rewriting an IRGlobalParam to an opaque intrinsic (e.g. `GetOptiXSbtDataPtr`) early in `linkAndOptimizeIR` (next to `collectOptiXEntryPointUniformParams`, slang-emit.cpp ~1391) breaks three things: (1) uses can sit in `expand` bodies, which are not `IRGlobalValueWithCode` (null deref); (2) `specializeResourceUsage` only specializes callee args that are `kIROp_GlobalParam`, so a helper taking the buffer as `ConstantBuffer<T>` stays unspecialized and its read is `__ldg`'d by type; (3) `buildEntryPointReferenceGraph` before specialization misses generic/interface calls, and before `moveGlobalVarInitializationToEntryPoints` it misses that CUDA runs EVERY static initializer in EVERY entry point. Run such lowering after the global-init move switch (~2490). Separately: a ConstantBuffer handle stored in a struct field / returned / chosen by `select` loses root provenance, and `isPointerToImmutableLocation` calls it immutable by type — `lowerImmutableBufferLoadForCUDA` needs a module-level guard (we keyed on the deduplicated IR types of `GetOptiXSbtDataPtr`). Context: shader-slang/slang#12628, PR #12646.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790831529525-cuda-optix-lower-shader-record-globals-after-speci.md`_
