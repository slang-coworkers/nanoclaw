---
title: "Verify a triage's predicate premise at HEAD (revert-drill) before fixing on top of it — #11889 HitObject NVAPI premise was empirically false"
type: learning
topic: agent-ops
source: learnings/1782991917563-verify-a-triage-s-predicate-premise-at-head-revert.md
---

# Verify a triage's predicate premise at HEAD (revert-drill) before fixing on top of it — #11889 HitObject NVAPI premise was empirically false

**Context:** shader-slang/slang#11903 "Invalid HLSL for SM 6.9 with NVAPI." Triage (and prior learning `1782986638349-slang-hitobject-sm6-9-nvapi-invalid-mix-capability.md`) claimed PR #11889's `if (targetCaps.implies(CapabilitySet(hlsl_nvapi)))` at `slang-emit-hlsl.cpp:1972` is **inert on sm_6_9**, so the HitObject *type* wrongly stays `dx::HitObject` while ops emit NVAPI → fix = swap `implies`→`atLeastOneSetImpliedInOther`.

**This premise is EMPIRICALLY FALSE at HEAD 4ed7d3cfc.** An instrumented debug slangc (fprintf of the actual predicate values in the emit branch) shows `implies(nvapi)=1` on sm_6_9 + `ser`/`ser_nvapi` raygen — the type is ALREADY `NvHitObject`. #11889 works. The proposed swap is a **verified no-op**: `implies(nvapi) == atLeastOneSetImpliedInOther(nvapi) == implies(sm69) == 1` in every HitObject/SER case constructible. (They are not globally equivalent — `implies` = whole-set/all-stage containment, `atLeastOneSetImpliedInOther` = single-set — and CAN diverge for a *partial-stage* capability set, but no valid single-stage HitObject entry point triggers that. `slang-ir-specialize-target-switch.cpp:52` really does use `atLeastOneSetImpliedInOther` to pick `__target_switch` cases, so the hypothesis was reasonable — just refuted by the build.)

**The REAL bug is the OPPOSITE direction and is a design gap, not a predicate bug:** on sm_6_9+NVAPI the type is correctly `NvHitObject`, but op *overloads that exist in only one ABI* mismatch it. The 2-arg `HitObject::Invoke(hit,payload)` is native-only (`[require(hlsl, ser_dxr…)]`, `__target_switch` has only `case hlsl:` at hlsl.meta.slang:23786; NVAPI's Invoke is the 3-arg overload needing `AccelerationStructure` at :23708) → emits `dx::HitObject::Invoke(NvHitObject)` → invalid HLSL. NVAPI SER (`ser_nvapi = raytracing+hlsl_nvapi`) and DXR-1.3 native SER (`ser_dxr = raytracing+ser_hlsl_native`) are distinct ABIs that must not be blended. Fix is a maintainer decision (single-source-of-truth so type+ALL ops resolve one ABI, or per-op ABI-coverage), NOT the type emitter.

**Also: don't parrot a triage's sub-claims.** The triage said "9-arg `MakeHit` is NVAPI-only → E41011 under `ser_dxr`." FALSE: the 9-arg MakeHit routes to `__hlslMakeHit_DXR` with a native `case hlsl:` branch (hlsl.meta.slang:24911). codex CODE_REVIEW caught me repeating this unverified.

**META-LESSONS (why this matters):**
1. A triage's "predicate X returns FALSE / is inert" claim MUST be proven by building the **pre-fix** binary (revert-drill) — the test passing both with AND without the change is the tell that the change is a no-op ("a change with no test that fails without it should not exist"). Here the drill saved shipping a no-op PR upstream.
2. **Instrument the actual value** (fprintf the predicate) rather than reasoning about `CapabilitySet` internals — my own "stage-coverage" root-cause hypothesis was ALSO wrong; `implies(nvapi)=1` refuted it.
3. Fork/subagent summaries are "trust but verify" — I re-ran the direct probe myself and instrumented before escalating.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782991917563-verify-a-triage-s-predicate-premise-at-head-revert.md`_
