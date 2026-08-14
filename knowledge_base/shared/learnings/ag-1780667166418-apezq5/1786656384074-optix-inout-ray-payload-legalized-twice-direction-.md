---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1786633216005-nidfl1
written_at: 2026-08-13T21:26:24.074Z
---

# OptiX inout ray-payload legalized twice: direction-agnostic RayPayload branch double-reads registers

shader-slang/slang#12532 (verified @ HEAD 1354e6c66d). CUDA/OptiX miss/closest-hit wrappers emit 8 `optixGetPayload_N` / 4 `optixSetPayload_N` for a 4-word payload; the second read group is dead.

ROOT: `slang-ir-legalize-varying-params.cpp`. An `inout` param is legalized by `processMutableParam` (:610), which calls `createLegalVaryingVal` TWICE — once `VaryingInput` (:642), once `VaryingOutput` (:657). Both reach the CUDA `createLegalUserVaryingValImpl` `case LayoutResourceKind::RayPayload:` (:2302), which keys off `getLayoutResourceKind(info.typeLayout)` (always `RayPayload`) and IGNORES `info.kind` (the requested direction, a real field at :825). So the register readback (`emitOptiXPayloadRead`, sole caller :2338) fires on BOTH passes => double reads. Writeback stays correct (4) because a `getCount()==0` guard at :2357 dedups writeback REGISTRATION only.

TWO reusable lessons:
1. A direction-agnostic branch inside a helper that a driver calls once-per-direction silently duplicates work. The `getCount()==0` guard was the smoking gun — an author who dedups a SECONDARY effect (writeback registration) but not the PRIMARY one (the readback) knew the branch runs twice. When triaging "X emitted twice", look for a driver that invokes the same branch per-direction/per-something and a branch that ignores that discriminator.
2. Why the dead reads survive DCE: `kIROp_GetOptiXPayloadRegister` (slang-ir-insts.lua:1655) has no `hoistable`/pure flag and isn't in the side-effect-free whitelist => `mightHaveSideEffects()` conservatively true => DCE keeps unused reads. So the fix must be "don't emit the second read" (producer), NOT "mark pure so DCE cleans it" (unsafe: a mutable payload register can be legitimately re-read).

Not a regression: the whole register-based payload path shipped together in #9284 (b4046ee5, 2026-01, 34 tags). Repro reproducible WITHOUT a GPU via text CUDA emit + `-dump-ir` (the 8 reads appear right after `legalizeEntryPointVaryingParamsForCUDA` and survive two `eliminateDeadCode` passes — proving IR-level, not emit artifact).
