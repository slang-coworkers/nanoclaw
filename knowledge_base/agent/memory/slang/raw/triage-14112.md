---
type: triage
description: "modf(float, out int) is rejected (E39999); DXC accepts it through general out-arg copy-out conversion. Recommended fix: out-int overloads in hlsl.meta.slang."
tags: [hlsl-compat, core-module, intrinsics, modf, out-parameter]
---
# Triage: shader-slang/slang#14112 — mod on (float,int)
Date: 2026-10-30 | feature-request (HLSL compatibility) | low | P2 | frontend / core module (hlsl.meta.slang)
Reporter: tangent-vector (MEMBER, self-assigned). The title says "mod", but the body is about `modf`. Duplicate: no (searched modf / out-param conversion; the nearest prior work is PR #5096, the WGSL modf/frexp struct return).

## What's broken / being requested
HLSL code `int ip; float f = modf(x, ip);` does not compile in Slang. The reporter prefers a `modf(float, out int)` overload that lowers correctly on all targets. They name implicit conversion of `out`/`inout` arguments as a weaker alternative.

## Repro (FACT, Release slangc @ 5a2dc5f21)
```
RWStructuredBuffer<float> o;
[numthreads(1,1,1)] void main(uint3 t : SV_DispatchThreadID) {
  float x = o[0]; int ip; float fr = modf(x, ip); o[1] = fr; o[2] = ip; }
```
`slangc r.slang -target spirv-asm -entry main -stage compute` →
`error[E39999]: no overload for 'modf' applicable to arguments of type (float, int)`.
- The same error occurs on hlsl, glsl, spirv, metal, wgsl, cuda and cpp, in both `.slang` and `.hlsl`/`-lang hlsl` mode, so no HLSL-compat path exists.
- `float3`/`int3` gives the same error, plus a misleading note E40022: "type argument 'vector<int,3>' does not conform to '__BuiltinFloatingPointType'". The scalar candidate inferred T from the out arg.
- `modf<float>(f, i)` gives E30047 "argument passed to parameter '1' must be l-value" plus note E30063.

## What HLSL/DXC actually does (FACT)
- The DXC intrinsic table (utils/hct/gen_intrin_main.txt:201) has `$type1 [[]] modf(in float_like<> x, out $type1 ip);`. `$type1` means "same type as arg 1", and `float_like` = f32/f16/min16float/literal float. **So the table has no int overload.**
- DXC 1.9/1.11, run locally with `-T cs_6_0` under HV 2016–202x, accepts `int ip; modf(x, ip)` **silently**. The AST binds `modf(float, float&)` with the int lvalue uncast.
  - DXIL: `Round_z(x)`, then `frac = x - trunc`, then `fptosi` on copy-out.
  - SPIR-V backend (SpirvEmitter.cpp processIntrinsicModf): `ModfStruct`, then `OpConvertFToS`. DXC has a test, intrinsics.modf.hlsl, for an int2x3 ip.
- DXC applies this through **general HLSL out-arg copy-out conversion**: a user `void g(float x, out float r)` called with an int also compiles silently in DXC. That same call is rejected in Slang.
- MS Learn's modf page lists the component types of `ip` as "float, int", described as "same as input x". fxc was not run (Windows-only).
- Semantics: the whole part is trunc(x) and keeps the sign of x; frac = x - trunc(x), with the same sign.

## Current Slang lowering (FACT; all correct for `out T`)
The only definitions are in source/slang/hlsl.meta.slang:
- **Scalar** :14531 `T modf(T x, out T ip)`, `T : __BuiltinFloatingPointType`, no `default:` case:
  - cpp/cuda: `$P_modf` → F32/F64/F16_modf → `::modff`/`::modf`
  - hlsl/glsl: `modf`
  - metal: `modf($0, *($1))`
  - spirv: `OpExtInst glsl450 Modf $x &ip` (pointer form, not ModfStruct)
  - wgsl: `__wgsl_modf` (:14560), which reads `modf(x).fract/.whole`
  - llvm: `@llvm.modf`
- **Vector** :14570: hlsl/glsl/metal/spirv/wgsl cases, then `default: VECTOR_MAP_BINARY`.
- **Matrix** :14601: hlsl, then `default: MATRIX_MAP_BINARY`.
- numerics wrapper: source/standard-modules/numerics/wrappers.slang:558.
- Runtime check (FACT, L40S, slang-test COMPARE_COMPUTE `-vk -cuda -cpu`) with x = {2.5, -2.5, -0.75, 3.0}:
  - frac = {0.5, -0.5, -0.75, 0}
  - whole = {2, -2, -0.0, 3}
  - Sign bits are correct, -0 included. HLSL truncation semantics hold on all three APIs.
- Not runtime-tested here: dx12, metal, wgpu.

## Why the int call fails (FACT, traced)
- Out-arg coercion exists, but only between integer types of the same size:
  - slang-check-expr.cpp:4456-4501 rewrites the arg into `OutImplicitCastExpr`/`InOutImplicitCastExpr` only when `_canLValueCoerce` passes.
  - `_canLValueCoerceScalarType` (:3910) requires the same `sizeInBytes` and both `Flag::Integer`.
- The IR pass slang-ir-lower-l-value-cast.cpp:125 `_processLValueCast` already handles any type pair (temp + `emitCast` copy-back). Same-size integers are reinterpreted in place on HLSL/C/CUDA (`_canReinterpretCast` :56).
- Generic inference: `TryJoinTypes` (slang-check-constraint.cpp:302) uses `getConversionCost`, which adds `kConversionCost_LValueCast`=800 (slang-check-conversion.cpp:3021). Because of that cost, the join prefers the **out arg's** type, so T=int, which then fails the `__BuiltinFloatingPointType` constraint.
- Side observation, out of scope: a user `T foo<T>(T x, out T y)` called with (float, int) infers T=int and warns about float→int.

## Candidate approaches
### Approach A: integer-out overloads of `modf` in the core module (reporter's preferred)
- Where: hlsl.meta.slang, next to :14531/:14570/:14601. Precedent: `frexp(T x, out int exp)` at :12253/:12293.
- Behaviour delta: add scalar `T modf(T x, out int ip)`, `vector<T,N> modf(vector<T,N> x, out vector<int,N> ip)`, and a matrix form. Each body is plain Slang on top of the existing float overload: `T w; T r = modf(x, w); ip = int(w); return r;`. Every target then reuses its validated float lowering, which is exactly DXC's model (trunc in float, then fptosi).
- Tradeoffs: tiny, local, and needs no per-target asm. `modf(f, floatVar)` still binds the exact-match float overload, and the int overload is unreachable for float outs because float↔int l-value coerce is rejected, so ranking is unchanged.
  - `uint ip`: it reaches the int overload through the existing same-size int↔uint l-value cast (a reinterpret, matching fptosi then bitcast). A generic `I : __BuiltinIntegerType` variant would cover uint/int64/int16 by value conversion, but needs the fixer to confirm the `I(w)` construction and the inference.
- Risk: |x| > INT_MAX or NaN/Inf gives an implementation-defined conversion, the same as DXC's fptosi poison. Mention it in the doc comment, not in a guard.

### Approach B: general numeric conversion for `out`/`inout` arguments (reporter's alternative; what DXC really does)
- Where:
  - slang-check-expr.cpp:3910 `_canLValueCoerceScalarType`: allow int↔float, and maybe different sizes.
  - slang-check-constraint.cpp:302 `TryJoinTypes`: stop the l-value cost from steering T to the out arg's type.
  - IR side: slang-ir-lower-l-value-cast.cpp:125 is already general.
- Behaviour delta: any function with `out float` accepts an int lvalue through a temp and a converting copy-back. This matches DXC for user functions too, not only modf.
- Tradeoffs: broad HLSL compatibility, but a large blast radius in overload resolution and the conversion-cost cache (see #13394, where the cache key needs l-value-ness). It also brings silent lossy conversions, unless a warning is added; DXC is silent. The reporter explicitly doesn't favour it.
- Risk: changes which overload wins where several overloads differ only in out-param type. Needs a language-design decision, and possibly HLSL-mode-only gating.

### Approach C: A now, B tracked separately
- Ship A for modf (a self-contained compat gap). Raise the general out-arg conversion (DXC accepts `g(out float)` with an int) as its own design issue for the language owners.

Ruled out: docs-only, because the reporter wants HLSL source to compile.

## Recommended path
**Approach A (C framing)**: add integer-out `modf` overloads (scalar/vector/matrix) to source/slang/hlsl.meta.slang, written in Slang on top of the existing float `modf` (`T w; T r = modf(x, w); ip = int(w); return r;`) and mirroring frexp's `out int` shape.
- Fixer decides `out int` vs generic `__BuiltinIntegerType`. Default to `out int`, the frexp precedent and the reporter's literal ask.
- Repro: the shader above with `slangc r.slang -target spirv-asm -entry main -stage compute` (E39999 today).
- Acceptance:
  1. Scalar int, int2/3/4 and an int matrix compile for hlsl/glsl/spirv (SLANG_RUN_SPIRV_VALIDATION=1)/metal/wgsl/cuda/cpp.
  2. A new COMPARE_COMPUTE test (e.g. tests/hlsl-intrinsic/modf-int-out.slang; -vk -cuda -cpu locally, plus dx12/mtl/wgpu in CI) with x = {2.5, -2.5, -0.75, 3.0} yields frac {0.5, -0.5, -0.75, 0} and ip {2, -2, 0, 3}.
  3. Existing modf tests are unchanged (glsl-intrinsic/intrinsic-basic-*, metal/math-*, wgsl/math-*, hlsl-intrinsic/scalar-half, numerics/*).
  4. `modf(float, out float)` still selects the original overload.
- Rebuild: after editing hlsl.meta.slang, touch it and build generate_core_module_headers (see CLAUDE.md).
- Gate: the reporter self-assigned. Hand to slang-fixer ONLY when tangent-vector asks for a bot PR.

## Sources
- DeepWiki: l-value implicit casts (int↔int only; temp + copy-back lowering); modf/frexp per-target lowering.
- DXC: gen_intrin_main.txt:201; HLOperationLower.cpp:2321 TranslateModF; SpirvEmitter.cpp:12087 processIntrinsicModf; MS Learn dx-graphics-hlsl-modf.
- Local probes: /tmp/repro-14112/ (A–D matrix, DXC AST/DXIL, modf-sem.final.slang), /tmp/t14112/, /tmp/modfprobe/. These are ephemeral.
- Related: PR #5096 (WGSL modf/frexp struct return); #13394 (conversion-cost cache l-value key).
