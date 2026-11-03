---
title: "Slang WGSL vector negation: the `(T(0) - x)` form, signed zero, and choosing the unary path without isSignedType"
type: concept
group: slang-backends
tags: [wgsl, negation, signed-zero, neg, tint, naga, dawn, webgpu-node, const-eval, isSignedType, getIntTypeSigned, half, f16, emit, slang]
source_count: 2
---

# Slang WGSL vector negation: the `(T(0) - x)` form, signed zero, and choosing the unary path without isSignedType

## TL;DR

- **WGSL vector `Neg` is emitted as `(vecN<T>(0) - x)`, which turns -0.0 into +0.0** (#14179). The WGSL spec lets implementations ignore a zero's sign, so this is cross-target bit parity, not a conformance bug.
- **It does not reproduce on NVIDIA Vulkan.** Tint lowers the literal-zero subtraction to `OpFSub %null %x`, and the driver folds it into a negate. The report came from Tint→MSL on Metal. A zero read from a buffer does keep the +0 result.
- **Constant operands lose -0 in both forms**, because Tint const-eval folds them. Concrete i32 overflow wraps in const-eval too, so INT_MIN is not an argument for the subtraction form.
- **The proposed fix keeps `(T(0) - x)` only for matrices and unsigned-integer vectors.** f32, f16 and i32 vectors fall through to the shared C-like `"- "` prefix, which already emits a space so the output never contains `--`.
- **naga rejects `--x`; Tint accepts it.** Any negation emitter must keep `- -x` spaced or parenthesized.
- **`isSignedType` has no `half` case (nor IntPtr).** A predicate "not signed ⇒ unsigned" therefore misclassifies f16. Test an unsigned integer as `isIntegralType(e) && !getIntTypeSigned(e)`; there is no `isUnsigned*` helper.
- **slang-test `-wgpu` rows are ignored in coworker builds** (`SLANG_EXCLUDE_DAWN=ON`); run WGSL on the GPU through node `webgpu` with `backend=vulkan` instead.

Matrix negation (`T(0) - m` is not valid WGSL at all, #13571) is on [WGSL matrix-operator validity](slang-backends-wgsl-matrix-and-validation.md), which also covers the naga and Tint validators. Running WGSL on the L40S is on [WGSL on the real GPU](slang-backends-wgsl-on-gpu-execution.md).

## What the subtraction form does to signed zero (#14179)

Consider `float3 y = -x;` with `x = float3(+0.0, 1, 2)` on `-target wgsl`. `WGSLSourceEmitter::tryEmitInstExprImpl`'s `kIROp_Neg` case prints `(vec3<f32>(0) - x)`. IEEE subtraction gives `0 - (+0) = +0`, while a true negate gives -0, so the WGSL output differs in bits from every other target. The WGSL spec, section "Differences from IEEE-754" (`index.bs` ~L14386), says "Implementations may ignore the sign field of a floating point zero value", so the subtraction form is spec-legal [WGSL signed-zero probes](../learnings/1793623630535-wgsl-signed-zero-probes-nvidia-vulkan-folds-0-x-in.md).

The bug is hard to see on the fleet GPU. Through node `webgpu@0.6.2` with `backend=vulkan` on the L40S, `(vec3<f32>(0) - x)` with x = +0 still gives 0x80000000. Tint's SPIR-V (dump it with `create(['backend=vulkan','enable-dawn-features=dump_shaders,disable_symbol_renaming'])`, which prints to stdout) shows `OpFSub %null %x`, and the NVIDIA driver folds a literal-zero subtraction into a negate. `z - x`, where z is +0 read from a buffer, gives +0, which is the IEEE result. The reporter saw the bug with Tint→MSL on Metal. For constant operands Tint const-eval folds `-(vec3<f32>(0.0,1,2))` to the +0 constant (`OpConstantComposite %float_0 ...`), so -0 is lost with either form. Integer overflow is not a reason to keep the subtraction: concrete i32 overflow wraps in const-eval as the spec says ("modulo 2^bitwidth"), and naga and Tint both accept `const r = vec3<i32>(0) - vec3<i32>(i32(-2147483648))` [same](../learnings/1793623630535-wgsl-signed-zero-probes-nvidia-vulkan-folds-0-x-in.md).

## The fix shape, and why isSignedType is the wrong selector

The fix proposed in triage keeps `(T(0) - x)` only for matrices (WGSL has no unary `-` on matrices) and for unsigned-integer vectors (WGSL rejects unary `-` on `u32`). Every other vector type, f32, f16 and i32, falls through to the base C-like `"- "` prefix path (`slang-emit-c-like.cpp:2761`). That path already emits a space, because naga rejects `--x` ("expected expression, found --") even though Tint accepts it; Slang's scalar `Neg` already prints `- - x`. History supports the change: v2025.1 emitted exactly the `- vecN<T>(...)` form, naga 30.2.0 and Tint accept it, and #7936 (v2025.14) introduced the subtraction. A +4/−1 prototype passed every WGSL-targeting test except the golden `tests/wgsl/neg-vector-precedence.slang:28-29`, which pins the old text [isSignedType has no HalfType case](../learnings/1793624281353-slang-issignedtype-has-no-halftype-case-use-isinte.md).

The selector is where a fix can go wrong silently. `isSignedType` (`slang-ir-util.cpp:3455`) returns true for float, double, bf16, fp8 and signed integers, but false for `half` (there is no `kIROp_HalfType` case) and for IntPtr. A rule written as "use the unary path when the element is signed" therefore keeps f16 vectors on the subtraction path, and nothing fails. Test "unsigned integer element" directly as `isIntegralType(e) && !getIntTypeSigned(e)` (`slang-ir.cpp:8698/8780`), or `!(isIntegralType(e) && !isSignedType(e))` for the inverse; no `isUnsigned*` helper exists [same](../learnings/1793624281353-slang-issignedtype-has-no-halftype-case-use-isinte.md), [WGSL signed-zero probes](../learnings/1793623630535-wgsl-signed-zero-probes-nvidia-vulkan-folds-0-x-in.md).

slang-test `-wgpu` rows show as ignored in coworker builds because `SLANG_EXCLUDE_DAWN=ON`, so check a value change like this one by running the emitted WGSL through Dawn node [same](../learnings/1793623630535-wgsl-signed-zero-probes-nvidia-vulkan-folds-0-x-in.md).

**Source learnings (2):**
- [WGSL signed-zero probes: NVIDIA Vulkan folds 0-x into -x, Tint const-eval drops -0, spec allows ignoring zero sign](../learnings/1793623630535-wgsl-signed-zero-probes-nvidia-vulkan-folds-0-x-in.md) — #14179 not reproducible on the L40S; Tint SPIR-V dump; i32 wraps; naga rejects `--x`; `isSignedType` half gap
- [Slang isSignedType() has no HalfType case; use isIntegralType && !getIntTypeSigned for "unsigned int"](../learnings/1793624281353-slang-issignedtype-has-no-halftype-case-use-isinte.md) — #14179 fix shape via the c-like `"- "` prefix; #7936 history; golden neg-vector-precedence test

_Catalog: [[wiki/index.md]]_
