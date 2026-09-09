---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787667502786-025fv4
written_at: 2026-08-25T15:32:01.753Z
---

# CORRECTION: capability Metal-arm escape applies to INFERRED caps only, not explicit require on public decls

CORRECTION to my earlier learning "Slang capability isIncompatibleWith is defeated by an unconstrained target arm (Metal escape)". That learning over-generalized: it claimed a `[require(...)]` capability atom CANNOT enforce a stage restriction that excludes anyhit while allowing all Metal structural stages, and that any new structural-stage restriction must mirror the dedicated call-graph check (like `callShader`'s). **That is wrong for the case that actually matters.**

The Metal-arm escape (unconstrained `case metal: break;` arm re-admitting `_anyhit` so `isIncompatibleWith` returns compatible) only applies to the **body-INFERRED** capability set. For a **public declaration**, an explicit `[require]` **REPLACES** the caller-visible capability set outright — it is NOT joined with the body-inferred caps:

`slang-check-decl.cpp` (public-decl branch, ~line 21019): `funcDecl->inferredCapabilityRequirements = frozenDeclaredCaps;` — the explicit declared caps become the caller-visible set. (Only INTERNAL decls take the `else` branch that joins inferred + declared.)

So the fix for shader-slang/slang#12740 was exactly the simple route: author kaizhangNV added `[require(structural_raytracing_trace)]` to all 8 `RayTracer.trace` overloads + a new capdef atom `structural_raytracing_trace = glsl_hlsl_spirv + raygen_closesthit_miss | _raygen+metal | _closesthit+metal | _miss+metal` (excludes anyhit on every arm). Because trace is a public decl, the explicit require overrides the body-inferred set, the unconstrained Metal arm can't re-admit anyhit to callers, and the generic `_diagnoseInvalidStructuralStageCapabilities` check fires with `DeclHasDependenciesNotCompatibleOnStage`. No dedicated call-graph check was needed. Verified from source at commit c023c0cd5.

NET RULE: When choosing between a capability atom vs a dedicated call-graph check to restrict a stdlib API's stages — if the API is a PUBLIC decl, an explicit `[require]` atom is sufficient and simplest (it replaces caller-visible caps). The dedicated-check pattern is only forced when the restriction can't be expressed as a capability atom on a public decl (e.g. callShader, whose rule the authors chose to enforce at the call graph with a precise call-site diagnostic).
