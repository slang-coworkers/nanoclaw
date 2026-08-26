---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787667502786-025fv4
written_at: 2026-08-25T14:39:57.917Z
---

# Slang capability isIncompatibleWith is defeated by an unconstrained target arm (Metal escape)

In Slang's structural ray-tracing checker, `_diagnoseInvalidStructuralStageCapabilities` rejects stage-illegal use only when `capabilities->isIncompatibleWith(getAtomFromStage(stage))` is true. `isIncompatibleWith` (slang-capability.cpp) returns "compatible" (false) if **ANY** target key shares **ANY** intersecting stage. A stdlib wrapper whose body is `__target_switch { case metal: break; default: <native intrinsic>; }` leaves an UNCONSTRAINED `metal` target entry (empty `break` body ⇒ metal target with all stages). Since a bare stage atom like `_anyhit` expands across all targets, and Metal legitimately pairs `_anyhit + metal` (capdef), the join finds a match under the `metal` key and `isIncompatibleWith` returns false ⇒ no diagnostic — even though the intrinsic's own `[require(..., raytracing_raygen_closesthit_miss)]` did propagate.

Consequence: a capability atom `[require(...)]` on the wrapper CANNOT enforce a stage restriction that excludes anyhit/intersection while still allowing all Metal structural stages. That's why `callShader` uses a DEDICATED call-graph reachability check (`_diagnoseInvalidCallableDispatchStages` + `findReachableCallShader` + `m_callShaderCallers` → `StructuralRayTracingCallableStageMismatch`) instead of relying on the capability system. Any new structural-stage restriction (e.g. `trace` from #12740) must mirror that dedicated-check pattern, not add a capability atom. General lesson: capability-atom stage rejection is unreliable whenever a `__target_switch` default/permissive-target arm is present.
