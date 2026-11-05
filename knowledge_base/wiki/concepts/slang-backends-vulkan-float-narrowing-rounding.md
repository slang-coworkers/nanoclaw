---
title: "Vulkan narrowing float conversions (float to half, float to BFloat16): implementation-defined rounding, no rounding mode from Slang, and how to write tests that survive it"
type: concept
group: slang-backends
tags: [vulkan, spirv, bfloat16, bf16, half, f16, OpFConvert, FPRoundingMode, RoundingModeRTE, RoundingModeRTZ, rounding, RNE, RTZ, narrowing-conversion, nvidia, l40s, windows-ci, cuda, slangpy, torch, test-design, spirv_asm]
source_count: 2
---

# Vulkan narrowing float conversions: implementation-defined rounding

A narrowing float conversion (`float` to `half`, `float` to `BFloat16`, `double` to `float`) can round differently on two Vulkan implementations, and both can be conformant. Slang does not pin a rounding mode, so a bit-exact test that passes on the fleet's Linux L40S can fail on the Windows NVIDIA CI runner. This page records what Slang emits, what the drivers were measured to do, what the Vulkan and SPIR-V rules allow, and how to write conversion tests that are portable. Other target differences for `half` are on [[wiki/concepts/slang-backends-wgsl-f16-and-const-expressions.md]].

## TL;DR

- **Slang emits every narrowing float cast as a bare `OpFConvert`**, with no `FPRoundingMode` decoration and no `RoundingModeRTE` execution mode. `emitOpDecorateFPRoundingMode` exists but has no callers, and Slang documents no runtime rounding mode.
- **Vulkan leaves the rounding of a narrowing `OpFConvert` to the implementation.** Measured: the Windows NVIDIA CI runner rounds `half` and bf16 toward zero; the Linux L40S (driver 595) rounds to nearest even. CUDA `__float2bfloat16` is round-to-nearest-even.
- **Maintainers treat Vulkan RTZ for `half` as permitted** (#13485). Round-to-nearest-even runtime tests for `half` are CPU/CUDA only (`tests/compute/half-runtime-rounding.slang`).
- **An `FPRoundingMode` decoration is honoured for `half` but ignored for bf16 on the L40S**, matching the Vulkan spec: bf16 is "correctly rounded with implementation-defined rounding mode", and the RTE/RTZ execution modes do not affect `BFloat16KHR`. For bf16, only software round-to-nearest-even is portable.
- **spirv-val accepts `FPRoundingMode` only on an `OpFConvert` whose uses are `OpStore`s into 16-bit external storage**, with a 16-bit-storage capability.
- **Test rule: on Vulkan, compare `half`/bf16 conversions with inputs the narrow type represents exactly, or within 1 ulp.** Examples: `x.to(torch.bfloat16).float()`, `torch.arange(-8, 8) * 0.25`.
- **A green L40S run does not prove the Windows CI passes.** Check `gh pr checks` before approving a conversion test.
- **In `spirv_asm`, write the rounding-mode operand numerically** (RTE = 0, RTZ = 1); the names `RTE`/`RTZ` are rejected.

## What Slang emits and what the rules allow

Slang (master 6b0467fb2, 2026-11-05) emits `float` to `half`, `float` to `BFloat16` and `double` to `float` as a bare `OpFConvert`. It emits no `FPRoundingMode` decoration and no `RoundingModeRTE` execution mode; `emitOpDecorateFPRoundingMode` exists in `slang-emit-spirv-ops.h` but has zero callers, and Slang documents no runtime rounding mode. In #13485 a maintainer ruled that Vulkan round-toward-zero for `half` is "permitted by the Vulkan precision rules", so the round-to-nearest-even runtime tests are CPU/CUDA only (`tests/compute/half-runtime-rounding.slang`). For bf16 the Vulkan spec is explicit that precision is "correctly rounded with implementation-defined rounding mode", and the `RoundingModeRTE`/`RoundingModeRTZ` execution modes do not affect `BFloat16KHR`. The SPIR-V validator (`validate_decorations.cpp:833` in spirv-tools) allows `FPRoundingMode` only on an `OpFConvert` whose uses are `OpStore` objects into 16-bit external storage, and it requires a 16-bit-storage capability ([Vulkan FPRoundingMode is honored for half but ignored for BFloat16 on the L40S](../learnings/1793845318999-vulkan-fproundingmode-is-honored-for-half-but-igno.md)).

## What the drivers do

The two NVIDIA Vulkan drivers the fleet sees disagree, and both are within the rules. SlangPy PR #1261 (torch bf16 support) had a test that wrote `BFloat16(float)` from a Vulkan kernel and compared it bit-exactly with `src.to(torch.bfloat16)`, which rounds to nearest even. It passed on the L40S under Linux (driver 595) and failed on the Windows CI runner, whose output was bit-identical to round-toward-zero, that is, dropping the low 16 bits of the float32 ([Vulkan float->BFloat16 rounding is driver-dependent](../learnings/1793843691531-vulkan-float-bfloat16-rounding-is-driver-dependent.md)). The follow-up measurement found the Windows NVIDIA CI rounding both bf16 and `half` toward zero, and the Linux L40S rounding both to nearest even. CUDA's `__float2bfloat16` is round-to-nearest-even.

To see whether a rounding-mode decoration would help, the L40S was probed with `slang-test -vk` and a `spirv_asm` block holding an `OpFConvert` plus `OpDecorate %r FPRoundingMode 1`. The operand must be numeric (RTE = 0, RTZ = 1), because `spirv_asm` rejects the names `RTZ` and `RTE`. For `half` the decoration is honoured (RTZ gives RTZ). For bf16 it is ignored and the result stays round-to-nearest-even, which is what the spec wording above predicts ([FPRoundingMode probe](../learnings/1793845318999-vulkan-fproundingmode-is-honored-for-half-but-igno.md)). So for bf16 no SPIR-V annotation makes Vulkan rounding portable; only a software round-to-nearest-even conversion does.

## Writing conversion tests that pass on every driver

A Vulkan test of a narrowing conversion should either use inputs that the narrow type represents exactly or compare within 1 ulp. For bf16 from torch, `x.to(torch.bfloat16).float()` produces exactly representable inputs, and `torch.arange(-8, 8) * 0.25` is a simple exact set. A bit-exact comparison against a round-to-nearest-even reference is valid only on CPU and CUDA. Because the fleet's L40S happens to round to nearest even, a local green run hides the problem: check the Windows CI result with `gh pr checks` before approving ([bf16 tests must use exact inputs](../learnings/1793843691531-vulkan-float-bfloat16-rounding-is-driver-dependent.md)). The SlangPy build traps from the same review (a stale `SGL_SLANG_VERSION` in `CMakeCache.txt`, and `CPATH` for Python headers extracted without root) are on [[wiki/concepts/slangpy-f0909b0-build-ci-toolchain.md]].

## See also

- [[wiki/concepts/slang-backends-wgsl-f16-and-const-expressions.md]] — `half` on WGSL, `half` through `u16` bridges
- [[wiki/concepts/slang-backends-spirv-access-chains-and-pointer-arithmetic.md]] — another case where Vulkan implementations read the same SPIR-V differently
- [[wiki/concepts/slangpy-f0909b0-build-ci-toolchain.md]] — SlangPy build and the `SGL_SLANG_VERSION` pin

**Source learnings (2):**
- [Vulkan float->BFloat16 rounding is driver-dependent; bf16 tests must use exact inputs](../learnings/1793843691531-vulkan-float-bfloat16-rounding-is-driver-dependent.md) — slangpy#1261: Windows CI rounds bf16 toward zero, L40S rounds to nearest even; use exact inputs or 1 ulp; check `gh pr checks`
- [Vulkan FPRoundingMode is honored for half but ignored for BFloat16 on the L40S; Slang emits no rounding mode](../learnings/1793845318999-vulkan-fproundingmode-is-honored-for-half-but-igno.md) — bare `OpFConvert`; `emitOpDecorateFPRoundingMode` has no callers; #13485 ruling; spirv-val rule; numeric `spirv_asm` operand

_Catalog: [[wiki/index.md]]_
