---
title: "Slang SPIR-V vec3 OpConstantComposite over-count — repro-blocked, post-legalize fold suspect (#12104)"
type: learning
topic: slang-compiler
source: learnings/1784069141044-slang-spir-v-vec3-opconstantcomposite-over-count-r.md
---

# Slang SPIR-V vec3 OpConstantComposite over-count — repro-blocked, post-legalize fold suspect (#12104)

shader-slang/slang#12104: user's `Transmission.rgs.hlsl` emits `OpConstantComposite %v3float %float_1 %float_1 %float_1 %float_1` (4 constituents on a vec3) → spirv-val rejects. Maintainer jkwak filed it; his minimal `float3(float2(1,1),1)` case validates fine.

**Not reproducible from reductions.** I tried ~11 minimal shapes on near-HEAD Debug slangc (`33f9ed0ce`): `float4(1,1,1,1).xyz`/`.rgb` (module-const + inline), `float3(1.0)` splat, `-O0/-O2/-O3`, `float3(c.x,c.y,c.z)` from a float4 const, arith fold, `saturate(float3())`, `lerp(v3,v3,scalar)`, `float4x4` row `.xyz` — ALL emit a correct 3-constituent OpConstantComposite. Implicit `float4→float3` truncation is rejected at type-check (E30019). Genuinely needs the reporter's real shader + version to trigger.

**Key discriminator for whoever picks this up:** the reported shape is an OVER-count (4 > 3 on vec3), NOT the sub-vector UNDER-count case `float3(float2(a,b),c)` (2 < 3). The under-count case is exactly what `SPIRVLegalizationContext::processConstructor` flattens (slang-ir-spirv-legalize.cpp:1795-1810), and it already validates. So don't chase the sub-vector path. A 4-on-vec3 fits better: (1) a vec4 constant MakeVector whose result *type* gets shrunk vec4→vec3 by a later fold without trimming operands; or (2) a MakeVector minted by `peepholeOptimize`/SCCP inside `simplifyIRForSpirvLegalization` (slang-ir-spirv-legalize.cpp:3324) which runs AFTER `processConstructor` and never re-enters its flatten path (the flatten gate at :1784 is also module-scope-only).

**Standing net worth landing regardless:** `emitOpConstantComposite` (slang-emit-spirv-ops.h:1417-1425) has NO constituent-count==element-count check, so a malformed MakeVector emits silently as invalid SPIR-V instead of asserting. A RELEASE_ASSERT/diagnostic there converts silent-invalid-output into a loud failure (the issue explicitly accepts "a diagnostic before emitting invalid SPIR-V").

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1784069141044-slang-spir-v-vec3-opconstantcomposite-over-count-r.md`_
