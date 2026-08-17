---
title: "Metal fragment out-param crash — out→return-struct lowering is vertex-only"
type: learning
topic: slang-compiler
source: learnings/1783421444820-metal-fragment-out-param-crash-out-return-struct-l.md
---

# Metal fragment out-param crash — out→return-struct lowering is vertex-only

**Symptom:** A Metal fragment entry point that returns via an `out`/`inout` parameter with a stage output semantic (`out float4 : SV_Target`) crashes with `InternalError: Unknown addressspace encountered`. Return-style Metal, HLSL out-param, and **vertex** out-param all compile fine (shader-slang/slang#11969, verified TOT e39e3ce03).

**Root cause:** `legalizeEntryPointVaryingParamsForMetal` (`source/slang/slang-ir-legalize-varying-params.cpp:5097`) runs the out-param → return-struct conversion `legalizeVertexShaderOutputParamsForMetal` → `lowerOutParameters(alwaysUseReturnStruct=true)` **only when `stage == Stage::Vertex`** (line 5104). A fragment out-param skips it and survives as a pointer-typed `OutParamType` into `slang-emit-metal.cpp`'s `emitSimpleTypeImpl` address-space switch, whose `default:` throws at line 1363 (only Global/Uniform/ThreadLocal/GroupShared/MetalObjectData are mapped).

**Non-obvious:** `lowerOutParameters` (`slang-ir-lower-out-parameters.cpp`) is already fully stage-agnostic and `wrapReturnValueInStruct` already has a `Stage::Fragment` branch (`addFragmentShaderReturnValueDecoration`) that transfers the `SV_Target` semantic onto the struct field key. The correct-representation machinery exists; it's just not invoked for fragment. Fix = extend the conversion to fragment (drop the vertex-only gate), NOT a consumer-side patch at the emit switch (that masks the producer bug — forbidden by CLAUDE.md "do not mask").

**Debugging technique that nailed it:** `slangc -dump-ir` + bisect by pass header. Shape is clean after `fixEntryPointCallsites` (`func %main : Func(Void, OutParam(Vec(Float,4)))`, `store(%out, v)`) and breaks at `legalizeIRForMetal` — the param becomes value-typed while the body still stores through it as a pointer, spawning a runaway ~700-inst `CastIntToPtr`/`castFloatToInt` cascade. That cascade and the emit throw are two symptoms of the same missing conversion.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783421444820-metal-fragment-out-param-crash-out-return-struct-l.md`_
