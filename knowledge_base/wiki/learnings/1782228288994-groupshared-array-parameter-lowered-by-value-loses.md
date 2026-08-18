---
title: "groupshared array PARAMETER lowered by-value loses TGSM (slang#10641)"
type: learning
topic: slang-compiler
source: learnings/1782228288994-groupshared-array-parameter-lowered-by-value-loses.md
---

# groupshared array PARAMETER lowered by-value loses TGSM (slang#10641)

**Bug class:** A `groupshared T scratch[N]` function *parameter* with no explicit direction modifier was lowered as by-value `In` in `getExplicitlyDeclaredParamPassingMode` (slang-lower-to-ir.cpp). By-value = per-thread local copy → on DXIL emits ZERO `addrspace(3)` (no thread-group-shared memory), so cross-thread scan/reduce silently return garbage. SPIRV/GLSL/Metal/WGSL were fine; only the D3D/HLSL *parameter* form was broken (direct groupshared globals worked).

**Fix (producer-side, two layers):**
1. Lowering: bare `groupshared` param (`HLSLGroupSharedModifier` AND `!hasModifier<InModifier>()`) → `ParamPassingMode::BorrowInOut` (mutable by-reference). `BorrowInOut` not strict `Ref` (Ref errors E30047 on non-l-value call sites). Mirrors `HLSLPayloadModifier`→`BorrowIn`.
2. HLSL emit: a by-ref groupshared param then emits DXC-illegal `groupshared inout uint s[N]` ("'inout' and 'groupshared' cannot be used together"). In `HLSLSourceEmitter::emitSimpleFuncParamImpl`, detect `IRGroupSharedRate` param, unwrap the direction wrapper, emit with no direction keyword (the `groupshared` keyword comes from the rate). Mirror the existing mesh-output-param unwrap a few lines up.

**Two scope traps codex caught (both real):**
- `InModifier` is attached ONLY by the parser for an explicit `in` (slang-parser.cpp:10775); a *bare* param has none. The `else` branch in `getExplicitlyDeclaredParamPassingMode` covers BOTH "no direction" and "explicit `in`" — so you MUST add `!hasModifier<InModifier>()` or you'd silently flip explicit `in groupshared` from by-value to by-reference. Checker detects unannotated params via `findModifier<InModifier>()==nullptr` (slang-check-decl.cpp:18364, slang-check-expr.cpp:5725) — confirms bare has no InModifier.
- `HLSLPayloadModifier` (mesh-shader input payload) ALSO lowers to a groupshared rate (slang-lower-to-ir.cpp ~4656). So an `IRGroupSharedRate` emit branch swallows payload params and bypasses `Super::emitSimpleFuncParamImpl`, dropping the required `in payload` emitted by `emitMeshShaderModifiers`. MUST exclude `IRHLSLMeshPayloadDecoration` from the branch. (Payload is read-only `borrow in`, never hits the illegal pairing anyway.)

**Verification without GPU:** `GroupMemoryBarrierWithGroupSync` is rejected on `-cpu` (E36107), so a cross-thread groupshared behavioral test cannot run on CPU. Use a `//TEST:SIMPLE(filecheck=HLSL): -target hlsl` structural lane (runs everywhere) whose discriminator is the *body per-thread copy* `uint l[int(N)] = scratch;` (`HLSL-NOT`) — NOT the param-decl `groupshared` keyword, which stays on the decl regardless of passing mode (false-positive trap). Add positive `HLSL: groupshared uint {{.*}}scratch` to pin the by-ref signature. Add `-vk`/`-dx12 -use-dxil` COMPARE_COMPUTE lanes for CI.

**Triage Approach B falsified:** extending `specializeAddressSpace` to D3D does NOT work — the defect is upstream of address-space recovery (param is a by-value `In` copy, no ptr-typed param for the pass to specialize). Fix the producer (lowering), where payload/`__ref` modes are decided. (GLSL uses base `specializeAddressSpace` gated on CodeGenTarget::GLSL at slang-emit.cpp:2278-2281; Metal/WGSL use `...ForMetal`/`...ForWGSL` variants; SPIRV uses base pass in spirv-legalize.cpp:2945.)

PR: shader-slang/slang#11709.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782228288994-groupshared-array-parameter-lowered-by-value-loses.md`_
