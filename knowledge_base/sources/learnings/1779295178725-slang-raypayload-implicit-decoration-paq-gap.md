# slang-raypayload-implicit-decoration-paq-gap

## Implicit `IRRayPayloadDecoration` skips Slang's PAQ frontend validation

Slang's frontend `checkRayPayloadStructFields` requires every field of a user-declared `[raypayload]` struct to carry at least one `RayPayloadReadSemantic` or `RayPayloadWriteSemantic`. But the IR pipeline has a **second path** that stamps `IRRayPayloadDecoration` on a struct *without* going through that validation:

- `slang-ir-hlsl-legalize.cpp::searchChildrenForForceVarIntoStructTemporarily` calls `addRayPayloadDecoration` whenever `__forceVarIntoRayPayloadStructTemporarily` is unwrapped (which happens for every plain struct passed to `TraceRay`/`HitObject::TraceRay` etc. without a user-declared `[raypayload]`).

So if you write `struct RayPayload { float3 color; }; TraceRay(..., payload);` (no `[raypayload]`), the IR ends up with `IRRayPayloadDecoration` on the struct but **no** `IRStageReadAccessDecoration`/`IRStageWriteAccessDecoration` on any field. At SM 6.7+ the HLSL emitter then writes `[raypayload]` (gated in `emitPostKeywordTypeAttributesImpl`) but emits no field qualifiers, and DXC rejects: *"payload type 'X' requires that all fields carry payload access qualifiers."* That's #10267.

**Why:** Slang's frontend validation only fires for `RayPayloadAttribute` modifiers in the AST. The IR-pass-stamped decoration bypasses it.

**How to apply:** When working on raypayload code paths, treat "has `IRRayPayloadDecoration`" as a *necessary but not sufficient* signal that PAQs are present on fields. If you need to emit / depend on PAQs, also check `IRStageReadAccessDecoration`/`IRStageWriteAccessDecoration` on each field's key — they may be absent. The existing precedent is `legalizeEmptyRayPayloadsForHLSL`, which attaches default `caller` stage decorations to its synthetic dummy field; the fix for #10267 generalizes that to all fields lacking PAQs (using full-stage defaults to preserve pre-SM 6.7 implicit any-stage access).

## Side note: pre-SM 6.7 PAQ semantics

Pre-SM 6.7 had no `[raypayload]` attribute and no payload access qualifiers — every stage could implicitly read and write every payload field. So when adding *defaults* for the implicit-payload case, `read(caller, anyhit, closesthit, miss) : write(caller, anyhit, closesthit, miss)` is the semantically correct choice. `caller`-only would silently regress shaders that touch payload from anyhit/closesthit/miss.
