---
type: triage
title: "Triage: shader-slang/slang#14330 — CUDA module-scope static const vector arithmetic emits dynamic __device__ init"
---
# Triage: shader-slang/slang#14330 — CUDA: module-scope `static const` vector arithmetic → dynamic `__device__` initializer
Date: 2026-11-06T18:38Z | bug | medium | P2 | target-emit (CUDA) + IR (global legalization / SCCP)
Requested by jkwak-work (cmt 6692283941; self-assigned 18:26:39Z). Triage only — no fixer handoff unless they ask.

## What's broken
`static const int2 v = int2(10,7) / int2(4,2);` (or a vector array element with `+ - * / %`, int or float)
→ CUDA emits `__device__ static const int2 v_0 = make_int2(..) / make_int2(..);` → NVRTC "dynamic initialization is not supported for a __device__ variable".

## Repro (master fef74e3c6, Release build; scratch /workspace/agent/scratch/t14330/)
`slangc repro.slang -target ptx -entry computeMain -stage compute -o repro.ptx`
Measured on ptx:
- FAIL: single int2 `/`; arrays with int2 `+ / %`… and float2 `* /` elements; `int2(10,7) / 2` and `float2x2(..) * 2.0` ("no operator matches int2 / int", emitted at the use site with no splat; in a function the emitter widens: `make_int2(int(2))`, `makeMatrix<float,2,2>(2.0f)` — locsplat2/locm2 pass).
- FAIL but = #13444 path (NOT this issue): casts. `float2(int2(10,7))` and even plain `static const int2 v = int2(10,7);` read via `float2(v)` (gcast; also v2026.13.1) → `__device__ ... = make_int2(..)`. Cause: CPP/CUDA fold veto for vector/matrix values used by a cast (slang-emit-cpp.cpp:1954-2010) + make_* call initializer. #13444's triage comment already says "Any module-scope vector or matrix cast hits the same path". A does not fix it.
- PASS: single int2 `+`/`*`, float2 `*`/`/`, `-v`, `<`, `.yx`; scalar `int2(10/4, 7/2)`; same ops inside a function body (emitter writes `x / make_int2(int(2))` there).
- `int2 d(int2,int2)` call in a static const array → E31226 (front-end, slang-check-decl.cpp:3834-3839), not this bug.

## Codebase digest
- Scalar folds: SCCP runs on the module during lowering, slang-lower-to-ir.cpp:15639, before the first IR dump (:15853) → LOWER-TO-IR already shows `makeVector(2,3)`.
- Vector does not: SCCP evaluator is scalar-only, slang-ir-sccp.cpp:1024-1027 ("For now we implement only basic folding operations for scalar values"; non-IRBasicType → Any). MakeVector not a lattice Constant (getLatticeVal :263-278) nor evaluable (:113-182). Peephole only identities (x*1, x+0; slang-ir-peephole.cpp:167-297). No other IR folder. Final IR still has module-scope `div(makeVector(10,7), makeVector(4,2))`.
- Legality: CUDA runs inlineGlobalConstantsForLegalization (slang-emit.cpp:2047-2052). isLegalGlobalInstForTarget (slang-ir-legalize-global-values.cpp:295-305) refuses only IRCall (#14204), then returns isSimpleConstantType(type) (:272-294) — type-only; vectors/matrices are simple (:278-281). shouldInlineInstImpl keeps a legal inst global (:153-159). Only CUDA-specific bit: half (:256-260).
- Emitter: a side-effect-free module-scope inst folds into its uses (slang-emit-c-like.cpp:1693-1697) → `+`/`*`/float ops look fine for a single vector (recomputed at each use). int Div/IRem is side-effecting unless divisor is a nonzero IntLit (slang-ir.cpp:9799-9811) → vector divisor → named `__device__` global. In arrays the elements must be emitted inside the global initializer.
- CUDA prelude: vector ops are `inline __device__` templates, not constexpr (prelude/slang-cuda-prelude.h:593-605, 658-664; SLANG_CUDA_CALL=__device__ :70). make_* also inline __device__ under NVRTC (:746-772). Brace init only for Make* inside a global MakeArray (slang-emit-cuda.cpp:590-683).
- Related #13444 (jkwak-work, regression): MakeMatrix / matrix cast legal by type → `makeMatrix<>(..)` global init. Same type-only legality gap. #14267 (bot draft) edits inlineGlobalValuesAndRemoveIfUnused in the same file.
- No test covers module-scope vector arithmetic through NVRTC (tests/cuda/optix-hitobject-transforms.slang:60-62 is SIMPLE emit only).

## Candidate approaches
### A: CUDA legality by opcode (per-thread)
- Where: GlobalInstLegalizationInliningContext::isLegalGlobalInstForTarget :295-305 (target flag like :256-260).
- Delta: on CUDA a vector/matrix-typed inst is a legal global only if it is a constant or a brace-initializable Make* (MakeVector/MakeMatrix/MakeArray/MakeStruct) of legal operands; arithmetic/casts/swizzles are inlined into each using function → computed per thread.
- Tradeoffs: robust for unfoldable shapes (casts, non-literal operands, matrix); CUDA-only; arrays containing such elements are rebuilt in each function (same shape #14204 gives calls).
- Risk: per-use cost for big tables; must not make plain Make* aggregates illegal (would inline every vector LUT). Might cover #13444 (MakeMatrix with layout cast) — unverified.
### B: Fold vector arithmetic in SCCP (compile-time)
- Where: slang-ir-sccp.cpp:1024-1027 guard, per-lane eval near :1052-1112, MakeVector-of-constants as Constant (:263-278), isEvaluableOpCode (:113, dup :2026).
- Delta: `int2(10,7)/int2(4,2)` → `makeVector(2,3)`; tables stay `__device__` data; all targets benefit.
- Tradeoffs: only constant operands; cast/matrix shapes still need A on CUDA.
- Risk: SCCP assumes IRConstant (unguarded as<IRConstant> in evalCast :340, evalComparisonImpl :581-582, evalBitCast :878, evalSelect :955; #12263 precedent); vector zero-lane divisor not diagnosed (isIntegralType scalar-only, :1077/:1099); makeVector not hoisted/deduped → meet by pointer; float folding precision policy.
### C: Emitter/prelude (rejected)
- Component-wise brace init for module-scope CUDA vector ops, or constexpr prelude operators/make_*. Consumer-side patch; constexpr needs literal-type construction; touches every CUDA program. Not recommended.

## Recommended path
Conditional (codex OUTPUT_REVIEW M2): per-thread rule → A (smaller, CUDA-only); literal vectors must fold → B + A fallback. Posted as cmt 6692726589.
Decision owner: jkwak-work / maintainers — folding vs per-thread changes the fix: per-thread → A alone; fold → B plus A as fallback for unfoldable shapes. Same question open on #14321 (cmt 6646031120).
Repro: `slangc repro.slang -target ptx -entry computeMain -stage compute -o repro.ptx`
Accept when: ptx compiles for single int2 `/ %`, arrays with int2/float2 `+ - * / %`, `int2(..) / 2`, `float2x2(..) * 2.0` (± -g) [casts = #13444, out of scope]; CUDA runtime test (COMPARE_COMPUTE -cuda) checks values; scalar/LUT arrays of plain makeVector stay module-scope globals (CHECK on emitted CUDA); no change for non-CUDA targets.

## Sources
- DeepWiki: SCCP scalar-only + runs on global scope; CUDA inlineGlobalConstantsForLegalization type-only legality.
- Shared wiki: #12263 SCCP IRConstant invariant; #14204 IRCall refusal; #12219 DCE hides module-scope repros.
- Issues: #13444, #14238/#14267, #14321 (Q1 6646031120), jhelferty-nv #14238 cmt 6639517817.
