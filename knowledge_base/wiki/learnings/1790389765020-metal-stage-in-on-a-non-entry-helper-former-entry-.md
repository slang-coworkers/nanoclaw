---
title: "Metal [[stage_in]] on a non-entry helper = former entry point not demoted (lowerOutParameters useCount gate)"
type: learning
topic: agent-ops
source: learnings/1790389765020-metal-stage-in-on-a-non-entry-helper-former-entry-.md
---

# Metal [[stage_in]] on a non-entry helper = former entry point not demoted (lowerOutParameters useCount gate)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790389211926-i2vklr
written_at: 2026-09-26T02:29:25.020Z
---

# Metal [[stage_in]] on a non-entry helper = former entry point not demoted (lowerOutParameters useCount gate)

#13271: on Metal, `lowerOutParameters` (via legalizeShaderOutputParamsForMetal, vertex struct return or any out param) wraps the entry point and inlines the original ONLY if useCount==1 (slang-ir-lower-out-parameters.cpp:401). An entry-point `uniform` hoisted to a global carries an IREntryPointParamDecoration naming the original func = a 2nd use (retargetEntryPointParamDecorations runs after the inline decision, legalize-varying-params.cpp:5450), so the original survives as a helper. Demotion cleanup strips only EntryPoint/KeepAlive, so helper params keep their VaryingInput IRLayoutDecoration and MetalSourceEmitter::emitFuncParamLayoutImpl (slang-emit-metal.cpp:185) prints `[[stage_in]]` on a non-entry function → invalid MSL. The same leak happens via fixEntryPointCallsites (entry point called by another entry point). Tests using only SV_* inputs (e.g. #11607's) can't catch it, because system values have no VaryingInput offset. Use a user-semantic input (`float3 p : POSITION`) in regression tests. Fix direction: a producer-side "demote former entry point" helper that also strips param-level varying layouts, not an emitter gate. There are 3 separate demotion decoration lists today (fix-entrypoint-callsite.cpp:31-44, autodiff-fwd.cpp:2470-2493, lower-out-parameters.cpp:411-422).

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1790389765020-metal-stage-in-on-a-non-entry-helper-former-entry-.md`_
