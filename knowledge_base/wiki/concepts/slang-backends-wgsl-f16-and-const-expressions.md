---
title: "Slang WGSL: half/f16 through u16 bridges, sub-word storage races, and const-expression NaN/Inf"
type: concept
group: slang-backends
tags: [wgsl, f16, half, uint16, E56103, byte-address-buffer, bit-cast, any-value, const-expression, override, specialization-constant, unpack2x16float, nan, infinity, tint, packed-float, slang]
---

# Slang WGSL: half/f16 through u16 bridges, sub-word storage races, and const-expression NaN/Inf

WGSL has `f16` but no 16-bit integer type, has 8-bit memory locations, forbids two resource variables at the same binding, and treats a NaN or infinity produced by a const-expression as a shader-creation error. Each of these rules breaks a Slang lowering that was designed around SPIR-V or HLSL. This page collects the WGSL `half` paths that still route through `UInt16`, the storage-model constraints that shape any sub-word or atomic byte-address design, and the const-expression rules behind Slang's `_slang_nonConstU32` and `_slang_getNan()` helpers. Validation tooling (naga-wasm versus Tint through Dawn's null backend) is on [WGSL emit and GPU-free validation](slang-backends-wgsl-matrix-and-validation.md); the broader backend is on [[wiki/concepts/slang-backends-wgsl-metal.md]].

## TL;DR

- **WGSL f16 floats work; E56103 means some IR pass bridged `half` through `UInt16`.** WGSL has no 16-bit integer type, and E56103 prints with no source location.
- **Four `half`→`UInt16` producers are known:** the byte-address legalizer (`getSameSizeUIntBaseType`), `lowerBitCast`'s `readObject` Half case (vectors included, because the same-size fast path is SPIR-V-only), `lowerBitCast` on structs with `half` fields, and any-value marshalling for dynamic dispatch. PR #13647 (open) covers byte-address loads and vector bitcasts only.
- **Diagnose with `-dump-ir-after legalizeByteAddressBufferOps -dump-ir-after lowerBitCast | grep UInt16`**, not DeepWiki, which wrongly claimed `lowerBitCast` emits `bitcast<f16>`.
- **WGSL natively has `bitcast<vec2<f16>>(u32/i32/f32)` and the reverse**; `f16tof32`/`f32tof16` map to `unpack2x16float`/`pack2x16float`.
- **Repro dynamic dispatch with `[anyValueSize(16)] interface`, `StructuredBuffer<IFoo>` and `-conformance "HF:IFoo=0"`.** `IFoo f = h;` specializes statically.
- **Write binary-target output to a real temp file.** `slangc -target spirv -o /dev/null` fails with E00004, which looks like a compile failure.
- **WGSL forbids binding aliasing**, so an atomic view of a `RWByteAddressBuffer` must retype the one `array<u32>` to `array<atomic<u32>>`, not add a second variable at the same binding.
- **WGSL memory locations are 8 bits**, so the byte-address legalizer's non-atomic u32 read-modify-write for a 2-byte store is a spec-level race with a neighbour's write. A race-free workaround is `RWStructuredBuffer<Atomic<uint>>` with `.and(~mask)` / `.or(f32tof16(x) << shift)`.
- **A `@const` builtin with literal operands is a const-expression; a NaN/Inf result there is a shader-creation error (§15.7).** Routing the value through `let`/`var`/`override` or a user `fn` takes it out of const evaluation.
- **Slang's `asfloat` on WGSL is opaque `bitcast<$TR>($0)`, but `bit_cast<float>` is `kIROp_BitCast`, which SCCP folds to a FloatLit and emits as `_slang_getNan()`.** That form is valid, but it loses the NaN payload.
- **Never wrap every call of a `@const` builtin in a prelude `fn`.** A user-fn call is illegal at module scope, so wrapping all calls breaks finite `[SpecializationConstant]` `override` initializers and `var<private>` initializers. Wrap only literal operands whose bits decode to Inf/NaN, in `WGSLSourceEmitter::emitIntrinsicCallExprImpl`, with the identity `_slang_nonConstU32`.
- **`unpack2x16float` evaluates both halves**, so check the exponent of each 16-bit half even for `f16tof32` (which reads `.x`).
- **Give a FileCheck test's static-const array distinct payloads.** Otherwise CSE reuses the direct stores' temporaries and the array path is never checked.
- **`override` defaults already hit the module-scope limit on master** (`override k = _slang_getInfinity(true)`), and a non-finite override expression is a pipeline-creation error anyway.
- **`ensurePrelude` dedups by content in practice**, because `getStringValue` interns strings by content.
- **BF16/FP8 `PackedFloatType` literals never reach the WGSL FloatLit `BaseType` switch** (`as<IRBasicType>` is null for them), so "the default falls into Half because FP8/BF16 literals exist" is not a valid rationale.

## Four IR producers route `half` through `UInt16` (#13634, #13647)

WGSL has `f16` but no 16-bit integer type. Several Slang IR passes still use `UInt16` as the same-size integer bridge for `half`, and the WGSL emitter then rejects the type with E56103 (`slang-emit-wgsl.cpp:555-560`). The diagnostic has no source location, because `diagnoseOnce` passes no `.location`.

1. **Byte-address legalization.** `getSameSizeUIntBaseType` maps Half to UInt16, and the size<4 load/store branches of `lowerBasicTypeOps` emit `intCast(UInt16)` followed by `bitCast(half)` (`slang-ir-byte-address-legalize.cpp:718`, `:941-990`, `:1649`, `:1760-1800`).
2. **`lowerBitCast` on scalars and vectors.** The `readObject` Half case (`slang-ir-lower-bit-cast.cpp:172-179`) reads through UInt16. Its same-size vector↔scalar "leave it alone" fast path (:280) applies only to direct SPIR-V, so `bit_cast<half2>(uint)` is scalarized into u16 on WGSL too [half via byte-address or bit_cast goes through uint16](../learnings/1792071772924-wgsl-half-via-byte-address-or-bit-cast-goes-throug.md).
3. **`lowerBitCast` on structs with `half` fields**, such as `bit_cast<P{half,half}>(uint)` or `bit_cast<uint2>(M)`, through `readObject` Half and `bitCastLeafValue` (`slang-ir-extract-value-from-type.cpp:36`).
4. **Any-value marshalling for dynamic dispatch** (`slang-ir-any-value-marshalling.cpp:423-433`, `:971-1002`) [more WGSL half→uint16 producers](../learnings/1792086575296-slang-more-wgsl-half-uint16-producers-beyond-bab-s.md).

Producers 3 and 4 were verified on master 28f3cd426 and persist with PR #13647, which exempts vectors only. Both shapes compile on SPIR-V and HLSL, so they are WGSL-only bugs. WGSL itself needs no bridge: it has `bitcast<vec2<f16>>(u32/i32/f32)` and the reverse (spec §17.2.1), `f16tof32`/`f32tof16` lower to `unpack2x16float`/`pack2x16float`, and `StructuredBuffer<half>` already works. Validate any f16-bitcast output with Tint rather than naga, which rejects these spec-valid overloads.

The fastest diagnosis is `slangc x.slang -target wgsl -o x.wgsl -dump-ir-after legalizeByteAddressBufferOps -dump-ir-after lowerBitCast | grep UInt16`. DeepWiki claimed that `lowerBitCast` emits `bitcast<f16>`; the IR dump disproved it, so verify DeepWiki pass-behaviour claims with a dump [half via byte-address or bit_cast goes through uint16](../learnings/1792071772924-wgsl-half-via-byte-address-or-bit-cast-goes-throug.md).

Reproducing producer 4 needs real dynamic dispatch. `IFoo f = h;` is not enough, because it specializes statically. Use `[anyValueSize(16)] interface IFoo`, a `StructuredBuffer<IFoo> objs` read as `objs[i].get()`, and `-conformance "HF:IFoo=0"`; without the conformance you get E50100. For binary targets, write output to a real temp file: `slangc -target spirv -o /dev/null` fails with E00004 "cannot write output file", which is easy to misread as a compile failure [more WGSL half→uint16 producers](../learnings/1792086575296-slang-more-wgsl-half-uint16-producers-beyond-bab-s.md).

## WGSL's storage model shapes sub-word stores and byte-address atomics (#13661)

Two WGSL spec rules (gpuweb `wgsl/index.bs`) constrain any design for sub-word byte-address stores or byte-address atomics:

- **No binding aliasing.** "Two different resource variables in a shader must not have the same group and binding values." The GLSL-style aliased view (`getEquivalentStructuredBufferParam`, or a second `Atomic<u32>` buffer at the same binding as proposed in #5084) is therefore a shader-creation error on WGSL. An atomic view of a `RWByteAddressBuffer` must retype the single `array<u32>` variable to `array<atomic<u32>>`, and every access to it then becomes `atomicLoad`/`atomicStore`.
- **8-bit memory locations.** Each WGSL memory location is one byte (§Memory Locations), so a non-atomic u32 read-modify-write that implements a 2-byte store races with a neighbouring invocation's write by spec. It is not merely "possibly stale".

The byte-address legalizer's sub-word store (`slang-ir-byte-address-legalize.cpp:1760-1800`) is already a plain non-atomic RMW on every target (master 6597ec920). On Metal, scalar sub-word byte-address loads and stores skip legalization entirely (`isTypeLegalForByteAddressLoadStore` :198-220 forces only 64-bit) and emit a whole-word `as_type<uint32_t>(half)`. A race-free WGSL workaround available today is `RWStructuredBuffer<Atomic<uint>>` with `.and(~mask)` followed by `.or(f32tof16(x) << shift)` [WGSL forbids binding aliasing and has 8-bit memory locations](../learnings/1792084642674-wgsl-forbids-binding-aliasing-8-bit-memory-locatio.md).

## Const-expression NaN/Inf and the `_slang_nonConstU32` value gate (#13635, #13657)

WGSL `bitcast`, `unpack2x16float` and similar builtins are `@const`, so a call whose operands are literals is a const-expression, and §15.7 (Finite Math Assumption) makes a NaN or infinity const-expression a shader-creation error. Tint reports, for example, `bitcast<f32>(u32(4294967295))` as "value -nan cannot be represented as 'f32'" (#13635). Routing the value through a `let`, `var` or `override`, or wrapping it in a user-declared `fn`, takes it out of const evaluation. Slang's two float-reinterpretation spellings behave differently here. On WGSL `asfloat` is `__intrinsic_asm "bitcast<$TR>($0)"`, which SCCP cannot see through, so the literal reaches Tint. `bit_cast<float>` is `kIROp_BitCast`, which SCCP folds to a FloatLit that the emitter prints as `_slang_getNan()`; that is accepted, but the NaN payload is lost [real-Tint validation via node webgpu](../learnings/1792074422249-gpu-free-real-tint-wgsl-validation-via-node-webgpu.md).

The obvious fix, routing every call through a `__requirePrelude` helper in the `hlsl.meta.slang` `case wgsl:` arm, regresses finite specialization constants. Consider:

```slang
[SpecializationConstant] const float k = f16tof32(0x3C00u);   // 1.0, valid on master
```

The constant becomes a module-scope WGSL `override k : f32 = _slang_f16tof32(...)`, and WGSL forbids user-function calls at module scope, so Tint rejects it with "user-declared functions cannot be called at module-scope". Module-scope `var<private>` initializers have the same restriction. The working pattern, used by PR #13645 for `asfloat` and PR #13670 for `f16tof32` (both open), gates on the value instead: `WGSLSourceEmitter::emitIntrinsicCallExprImpl` wraps only a literal operand whose bits decode to Inf or NaN, using the identity helper `fn _slang_nonConstU32(x: u32) -> u32`. Those values are already invalid in any const or override context, so nothing that compiled before regresses. `unpack2x16float` evaluates both halves, so the gate must check the exponent of each 16-bit half, even for `f16tof32`, which reads only `.x`. No existing test covered `f16tof32` inside a spec constant; `/code-review` caught the regression. When proposing any WGSL "wrap it in a helper fn" fix, prototype it in a spec-constant initializer and a module-scope initializer, not only inside a function body [a prelude user-fn wrapper breaks override initializers](../learnings/1792088805711-wgsl-const-expression-fixes-a-user-fn-wrapper-brea.md).

Reviewing #13670 added four facts [CSE can make a static-const-array FileCheck case unobservable](../learnings/1792094872802-wgsl-cse-can-make-a-static-const-array-filecheck-c.md):

- **CSE can make a test case vacuous.** If `static const float k[3] = { f16tof32(0x7C00u), ... }` repeats calls that the entry point also stores directly, Slang CSEs them and the inlined array is built from the same `_S1.._S3` temporaries, so every `-DAG` line is satisfied by the direct stores. Give the array distinct payloads (for example NaN 0x7C01/0xFC01/0x7E01) so it emits inline with its own values, and confirm the new lines fail on a base build.
- **`override` defaults already have the module-scope problem.** On master, `[SpecializationConstant] const float k = 1.0f/0.0f;` emits `override k = _slang_getInfinity(true)` through `WGSLSourceEmitter::emitGlobalParamDefaultVal` (slang-emit-wgsl.cpp:763), and Tint rejects it. Static globals are fine because they are inlined into functions. §15.7.2 makes a non-finite override expression a pipeline-creation error anyway, so this affects only diagnostic quality.
- **`ensurePrelude` dedup is by content in practice.** It is keyed on the `const char*`, but `IRBuilder::getStringValue` interns strings by content, so two PRs that define the same prelude text (as #13645 and #13670 do for `_slang_nonConstU32`) emit it once.
- **§15.7.2 on runtime values:** "When a runtime expression would produce an infinity or NaN, the result is an indeterminate value for the target type." For `unpack2x16float` that type is the whole `vec2<f32>`, so reading `.x` of a result whose other half is Inf is not spec-guaranteed.

## FloatLit emission and `PackedFloatType` (PR #13680)

In `WGSLSourceEmitter::emitSimpleValueImpl` (`kIROp_FloatLit`), the `switch (type->getBaseType())` runs only when `as<IRBasicType>(inst->getDataType())` is non-null. `FloatE4M3Type`, `FloatE5M2Type` and `BFloat16Type` are `PackedFloatType`, a sibling of `BasicType` in `slang-ir-insts.lua` rather than a child, so they take the untyped `else` branch. The empty outer `default:` that falls through into `case BaseType::Half` is reachable only by basic types that never carry a FloatLit (Int, Bool and so on), so a review rationale of "the default falls into Half because FP8/BF16 literals exist" is wrong. In practice a `BFloat16(1.0/0.0)` local constant-folds to an f32 `_slang_getInfinity(true)` before emit [PackedFloat types never reach the WGSL FloatLit switch](../learnings/1792099072974-slang-packedfloat-types-bf16-fp8-never-reach-the-w.md).

**Source learnings (7):**
- [WGSL: half via byte-address or bit_cast goes through uint16 → E56103 (two IR producers)](../learnings/1792071772924-wgsl-half-via-byte-address-or-bit-cast-goes-throug.md) — `getSameSizeUIntBaseType` and `readObject` Half; SPIR-V-only vector fast path; IR-dump diagnosis (#13634)
- [Slang: more WGSL half→uint16 producers beyond BAB (struct bit_cast, any-value); how to repro dynamic dispatch](../learnings/1792086575296-slang-more-wgsl-half-uint16-producers-beyond-bab-s.md) — persists with #13647; `[anyValueSize]` + `-conformance` repro; `-o /dev/null` E00004 trap
- [WGSL forbids binding aliasing + 8-bit memory locations: shapes any sub-word BAB store / BAB atomics design](../learnings/1792084642674-wgsl-forbids-binding-aliasing-8-bit-memory-locatio.md) — retype to `array<atomic<u32>>`; sub-word RMW races by spec; Atomic<uint> workaround (#13661)
- [GPU-free real-Tint WGSL validation via node webgpu (Dawn) null backend](../learnings/1792074422249-gpu-free-real-tint-wgsl-validation-via-node-webgpu.md) — §15.7 NaN/Inf const-expressions; `asfloat` vs SCCP-folded `bit_cast<float>` (#13635)
- [WGSL const-expression fixes: a user-fn wrapper breaks spec-constant override initializers — value-gate it](../learnings/1792088805711-wgsl-const-expression-fixes-a-user-fn-wrapper-brea.md) — wrap only non-finite literals with `_slang_nonConstU32`; check both halves of `unpack2x16float` (#13657, PR #13670)
- [WGSL: CSE can make a static-const-array FileCheck case unobservable; module-scope wrappers already fail for override defaults](../learnings/1792094872802-wgsl-cse-can-make-a-static-const-array-filecheck-c.md) — distinct payloads; `emitGlobalParamDefaultVal`; prelude dedup by content; §15.7.2
- [slang: PackedFloat types (BF16/FP8) never reach the WGSL FloatLit BaseType switch](../learnings/1792099072974-slang-packedfloat-types-bf16-fp8-never-reach-the-w.md) — `PackedFloatType` is a sibling of `BasicType`; Tint rows ignored on Linux (PR #13680)

_Catalog: [[wiki/index.md]]_
