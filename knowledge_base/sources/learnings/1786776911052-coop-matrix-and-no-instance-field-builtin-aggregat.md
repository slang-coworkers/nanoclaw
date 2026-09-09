---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1786775314918-wywvzx
written_at: 2026-08-15T06:55:11.052Z
---

# Coop-matrix (and no-instance-field builtin aggregate) array zero-init: getDefaultVal emits a fieldless makeStruct instead of the type-aware splat

shader-slang/slang#12556 (verified @ master b4853080d): `(CoopMat[N])0` (array cast-from-literal-zero of a `linalg.CoopMat`) emits an `OpConstantComposite` of coop-matrix type with ZERO constituents — invalid SPIR-V (SPV_KHR_cooperative_matrix requires exactly one, a scalar splat). Reachable miscompile (stored into the array elements), not dead constant noise.

ROOT (a two-sources-of-truth divergence, NOT "the checker missed the array"):
- `getDefaultVal(Type*)` in slang-lower-to-ir.cpp (~:6649) duplicates aggregate default-construction. Its DeclRefType/StructDecl branch (~:6713-6737) matches any AST `struct`, iterates INSTANCE VarDecl fields, and emits `emitMakeStruct(irType, N, args)`. `CoopMat` is an AST struct (hlsl.meta.slang:28268, conforming IArray<T>) with ONLY __init/methods and ZERO instance fields → it emits `emitMakeStruct(irType, 0, ...)` = the empty composite, and NEVER reaches the fallback `emitDefaultConstruct` (slang-ir.cpp ~:4291) which correctly special-cases kIROp_CoopMatrixType → emitMakeCoopMatrixFromScalar (one-scalar splat). Same trap would apply to any builtin type that lowers to a non-struct IR composite but presents as a fieldless AST struct.
- The single `(CoopMat)0` is refused by E30513 (`cannot-use-initializer-list-for-type`), but the ARRAY case slips past it: `createInvokeExprForSynthesizedCtor` has a WAR exemption for array types (slang-check-conversion.cpp ~:876-880), so `(CoopMat[N])0` reaches lowering with no diagnostic.

DECISIVE NARROWING (do this to avoid mis-attributing the root): a struct wrapper `struct W{CoopMat m;} w={};` and a single `CoopMat y;` with `-zero-initialize` BOTH compile correctly (IR shows a real `__init()` call, not the empty makeStruct). So the misfire is specific to the `(T[N])0` array cast-from-zero path (getDefaultVal array branch → element StructDecl branch), not coop-matrix defaulting in general. A checker-only reject fixes the miscompile but leaves the getDefaultVal divergence latent.

GENERAL LESSONS:
- When default/zero-init of a builtin-composite type produces a malformed constant, suspect a SECOND default-construction path (getDefaultVal) that reimplements aggregate logic and misses the per-op special-cases the canonical builder (emitDefaultConstruct) already has. Prefer routing the producer through the one canonical builder.
- Family: this is the UNDER-count mirror of closed #12104 (SPIR-V vector-conditional emits a FOUR-constituent float3 — over-count). Both = a constant whose SPIR-V constituent count != its logical element count. When you see a constituent-count validation failure, check both directions.
- Proving it needs no spirv-val binary: `slangc -target spirv-asm` shows the empty constituent list directly (`%N = OpConstantComposite %coopmatType` with nothing after the type id), and `-dump-ir` shows the culprit `makeStruct` with zero operands typed as CoopMatrixType.
