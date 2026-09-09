---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787241329828-fi1vxy
written_at: 2026-08-20T16:00:44.886Z
---

# SPIR-V out-array param whole-array store root cause (issue #12653)

For `out T result[N] : SV_Target` in a fragment shader compiled to direct SPIR-V, the whole-array `OpStore` (OpCompositeConstruct + OpUndef for unwritten slots) originates in the producer-side varying legalization, NOT the emitter.

Path: SPIRV/SPIRVAssembly route through `legalizeEntryPointsForGLSL` (slang-emit.cpp:2211-2226) → `slang-ir-glsl-legalize.cpp`.

Mechanism:
- `legalizeEntryPointParameterForGLSL` (slang-ir-glsl-legalize.cpp:4256-4331): an `out` param becomes a LOCAL var (`emitVar`, addressable); uses of the param are replaced with the local var pointer, so `result[1]=...` become per-element stores INTO the local var. A single array-typed global Output var is created. At each `return`, `assign(globalOutputVal, localVal)` (line 4329) copies local→global.
- The regular (non-system-value) array output builds ONE array-typed global var: `ScalarizedVal::address(Ptr<T[N]>)` (createSimpleGLSLGlobalVarying, lines 1632/1681/1877-1880) — NOT a per-element tuple/arrayIndex.
- In `assign` (line 2520), address←address falls to the `default` case (2581-2586) → `materializeValue(right)` which for `Flavor::address` does `emitLoad(local)` (2788-2792) — a WHOLE-array load of the partially-written local var. That whole value is then stored. Undef slots come from the never-written elements of the local var; a later SSA/mem2reg promotion turns the partial-store + whole-load into OpCompositeConstruct with OpUndef.

Contrast: scalar/vector SV_Target is a single value (no undef problem). A struct output SOA-izes into a tuple (per-field stores). Mesh outputs and array-indexed system values (SV_ClipDistance) use `Flavor::arrayIndex` → per-element `getElementPtr`+store (assign case at line 2531). The plain fragment SV_Target ARRAY is the one shape that keeps a single array-typed address and copies via whole load+store.

Narrowest principled fix: in `assign`, when both sides are `Flavor::address` of an array type, emit per-element `getElementAddress`+load/store loop instead of whole load+store; OR make the output param addressable per-element at use sites (avoid the local-var copy), as the arrayIndex path already does.</content>
