---
type: triage
---
# Triage: shader-slang/slang#14451 — [SPIR-V] Integer mad() emits GLSL.std.450 Fma
Date: 2026-11-11 | bug | medium | P2 | core-module intrinsics → target-emit (SPIR-V, GLSL, CUDA, CPU)

## What's broken
The integer overloads of `mad` (`T : __BuiltinIntegerType`, scalar + vector; matrix maps onto them) carry
float-only target arms. Every non-HLSL target that has an explicit arm emits a float FMA on integer operands.
Not a regression: the arms date from the first integer `mad` (#2684, commit 6f31eae79); #4050 just moved them into `__target_switch`.

## Repro (master 6862c98ec, release slangc rebuilt 2026-11-11 06:13Z)
`SLANG_RUN_SPIRV_VALIDATION=1 slangc issue.slang -target spirv-asm -entry CSMain -stage compute`
→ `GLSL.std.450 Fma: expected Result Type to be a float scalar or vector type` / `OpExtInst %uint %23 Fma`.
Per-type and per-target matrix (all FACT, observed):
| type | spirv | glsl (→glslang) | cuda (nvrtc) | cpp (gcc) | hlsl/dxil | metal/wgsl |
|---|---|---|---|---|---|---|
| uint, int, int16_t, int64_t, uint64_t | invalid Fma | `fma(...)`; glslang: cannot convert float→uint | `U32_fma`/`I64_fma` undefined | `U32_fma` undefined | `mad` → UMad/IMad (OK) | E36107 unavailable (integer mad has no metal/wgsl in `require`) |
| uint3, int4 | invalid Fma (`%v3uint`, `%v4int`) | same | per-element `I32_fma` undefined | same | OK | same |
| int2x2 | invalid Fma (row-wise `%v2int`) | — | — | — | OK | — |
Float `mad` sanity: `OpExtInst %float Fma` validates (unchanged, correct).

## Codebase digest
- `source/slang/hlsl.meta.slang:13619-13636` integer scalar `mad`: `case cpp/cuda: "$P_fma(...)"`, `case glsl: "fma"`, `case spirv: OpExtInst $$T result glsl450 Fma`, `default: return mvalue * avalue + bvalue;` (default already correct).
- `hlsl.meta.slang:13638-13653` integer vector `mad`: `glsl: "fma"`, `spirv: ... glsl450 Fma`, `default: VECTOR_MAP_TRINARY`.
- `hlsl.meta.slang:13655-13666` integer matrix `mad`: `hlsl` + `MATRIX_MAP_TRINARY` → inherits vector bug.
- `$P_fma` → `I32_fma`/`U32_fma`/`I64_fma` (expansion `source/slang/slang-intrinsic-expand.cpp:795`); preludes only define F16/F32/F64_fma (`prelude/slang-cpp-scalar-intrinsics.h:130`, `prelude/slang-cuda-prelude.h:2430`).
- Float `mad` 13566-13617 is fine. `fma` has no integer overload (all `__BuiltinFloatingPointType`, 12038-12095).
- No test covers integer `mad` on any target (only `mad(` in tests is a LANG_SERVER float3 test).
- Template test: `tests/hlsl-intrinsic/abs-unsigned.slang` (#13988) — COMPARE_COMPUTE on cpu/cuda/vk/vk-via-glsl/llvm + SPIR-V filecheck.

## Candidate approaches
### A: drop the float-only arms; let the integer default lower to IR mul+add (RECOMMENDED)
- Where: hlsl.meta.slang:13626-13632 (scalar: delete cpp/cuda/glsl/spirv arms), 13645-13651 (vector: delete glsl/spirv arms; make `default: return mvalue * avalue + bvalue;` so SPIR-V gets vector OpIMul/OpIAdd instead of a scalarized loop).
- Delta: SPIR-V `OpIMul`+`OpIAdd`; GLSL/CUDA/CPU `a * b + c`; HLSL keeps `mad` (DXIL IMad/UMad); LLVM unchanged (already default).
- Tradeoffs: smallest diff, uses the generic arithmetic path that already emits correct per-type ops on every backend; one source of truth.
- Risk: low. Integer mul+add wraps identically to HLSL IMad/UMad. Watch that the vector `*` in a generic `__BuiltinIntegerType` context resolves (it does for the scalar default today).
### B: keep explicit arms with correct integer code
- spirv_asm `OpIMul` then `OpIAdd`; glsl `__intrinsic_asm "(($0) * ($1) + ($2))"`; cpp/cuda same.
- Tradeoffs: more code duplicating what the default already does; hand-written spirv_asm is opaque to `precise`/optimizations. No benefit over A.
### C: add `I32/U32/I64/U64/I16/..._fma` helpers to the CPU and CUDA preludes
- Fixes cpp/cuda only; SPIR-V/GLSL still broken; grows two preludes for a fake "fma". Rejected as partial.
### D: SPIR-V emitter/legalizer rewrites integer-typed GLSL.std.450 Fma
- Consumer-side patching of a malformed producer (CLAUDE.md "do not mask"). Rejected.

## Recommended path (solution brief)
- Hypothesis (FACT, read + reproduced): integer `mad` overloads route to float-only `Fma`/`fma`/`$P_fma` arms.
- Files: `source/slang/hlsl.meta.slang:13619-13653` only.
- Change: Approach A — scalar keeps `hlsl` + default; vector keeps `hlsl` + `default: return mvalue * avalue + bvalue;`; matrix untouched.
- Optional (fixer's call, same PR only with a test): add metal/wgsl to the integer `require` (`cpp_cuda_glsl_hlsl_metal_spirv_wgsl_llvm`, as float `mad` has) — integer `mad` is HLSL-legal and the default arm works there. Otherwise note it as a follow-up.
- Repro: `SLANG_RUN_SPIRV_VALIDATION=1 build/Release/bin/slangc /tmp/r14451/issue.slang -target spirv-asm -entry CSMain -stage compute`.
- Accept when: (1) repro validates and shows `OpIMul`+`OpIAdd`, no `Fma`; (2) new `tests/hlsl-intrinsic/mad-integer.slang` (modelled on abs-unsigned.slang): COMPARE_COMPUTE on -cpu, -cuda, -vk, -vk -emit-spirv-via-glsl, -llvm covering int, uint, int3/uint4, int64_t/uint64_t (with -render-feature int64), int2x2 with wraparound inputs; SPIR-V filecheck `CHECK-NOT: Fma` on integer result types + float `mad` still `Fma`; HLSL filecheck still `mad(`; (3) run GPU rows on the L40S; (4) hlsl-intrinsic + glsl-intrinsic suites unchanged.

## Sources
- DeepWiki: two questions (mad lowering; int/float arm selection) — confirmed `__isFloat`/`__isSignedInt` helpers and the per-type GLSL.std.450 op split; no mad-specific detail.
- Related, not duplicates: #13773 (float fma not guaranteed fused on SPIR-V; PR #13779 touches only `fma` hlsl arms, no conflict); #14061 (other GLSL.std.450 ops invalid on double — same "ext-inst type validity" class); #13983/#13988 (abs unsigned SAbs, same class, fixed).
- Shared learnings: `__isFloat` true for double (#13773); abs-unsigned per-target behaviour.
