---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1786474751808-aq5ola
written_at: 2026-08-11T22:32:01.970Z
---

# getEntryPointCode OOB entry-point index: one missing bounds check, two symptoms (abort vs segfault)

shader-slang/slang#12482. When a composite/linked `IComponentType` is asked for an entry-point index it doesn't contain (e.g. `createCompositeComponentType(count=1)` excludes the entry point, then `getEntryPointCode(0,...)`), the abort is NOT specific to empty composites and NOT specific to SPIR-V.

ROOT (verified @cad86b5d3, built C++ harness vs libslang, no GPU): `ComponentType::getEntryPointCode` (slang-linkable.cpp:241) bounds-checks `targetIndex` but NOT `entryPointIndex`. It passes the index to `TargetProgram::getOrCreateEntryPointResult` (slang-target-program.cpp:119), which only rejects `< 0` and then RESIZES its result cache to `entryPointIndex+1` for any positive index — never compares against `getEntryPointCount()`. So positive out-of-range sails through to codegen.

TWO manifestations off the ONE missing check:
- SPIR-V: reaches `specializeIRForEntryPoint` (slang-ir-link.cpp:1134) → `SLANG_UNEXPECTED("no matching IR symbol")` → caught → E99997 diagnostic + SLANG_FAIL.
- HLSL/GLSL: `emitEntryPointsSourceFromIR` (slang-emit.cpp:2804) does `getEntryPoint(getSingleEntryPointIndex())->getStage()`; `CompositeComponentType::getEntryPoint` (slang-linkable-impls.cpp:120) does unchecked `m_entryPoints[index]` on an empty list → SEGFAULT (null-deref in Profile::getStage()).

ASYMMETRY worth checking on similar APIs: negative index is caught but returns silent SLANG_FAIL (no diagnostic); positive OOB isn't caught at all.

FIX layer: `getOrCreateEntryPointResult` is the SOLE shared choke point for getEntryPointCode / getEntryPointHostCallable / getEntryPointMetadata / getEntryPointCompileResult — validate `entryPointIndex` there against `getEntryPointCount()` (a base-class virtual, slang-linkable.h:225), emit a NEW "index out of range" diagnostic, return SLANG_E_INVALID_ARG. One check fixes all four + both symptoms. No existing OOB-entry-point diagnostic exists.

METHOD note: the SPIR-V-vs-source symptom split is only visible if you test more than one target — the reporter only saw SPIR-V's E99997; HLSL/GLSL segfault is strictly more severe and was unreported. Always run the guilty flow on ≥2 targets when the abort is downstream of the emit-path split.
