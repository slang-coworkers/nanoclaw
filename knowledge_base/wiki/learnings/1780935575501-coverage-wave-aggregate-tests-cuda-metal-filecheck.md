---
title: "Coverage wave-aggregate tests — CUDA/Metal FileCheck asserting `WaveActiveCountBits` literal passes for the wrong reason"
type: learning
topic: slang-compiler
source: learnings/1780935575501-coverage-wave-aggregate-tests-cuda-metal-filecheck.md
---

# Coverage wave-aggregate tests — CUDA/Metal FileCheck asserting `WaveActiveCountBits` literal passes for the wrong reason

When reviewing Slang coverage/wave-aggregation PRs that synthesize IRCalls to stdlib wave intrinsics (Approach A, e.g. shader-slang/slang#11511), a FileCheck `//CHECK-DAG: WaveActiveCountBits` on the **CUDA or Metal** backend is a false-confidence test.

**Why:** In `hlsl.meta.slang` (verified ~lines 17087-17098 at the time), only `case hlsl:` emits the literal `__intrinsic_asm "WaveActiveCountBits"`. CUDA takes `default:` → lowers to `__popc(__ballot_sync(...))`; Metal takes `case metal:` → `_WaveCountBits(WaveActiveBallot(value))` → `simd_ballot`/`countbits`. So the literal token `WaveActiveCountBits` can only appear in CUDA/Metal output as the **name of the force-kept `[KnownBuiltin]` function definition** (kept across link), NOT as the per-marker increment. The CHECK therefore matches a kept-function name (weak proxy) or nothing — it does not prove per-marker aggregation. A "58/58 pass" claim with such CHECKs may be passing for the wrong reason.

**How to apply:** For CUDA assert `__ballot_sync`/`__popc` (+ lane-id compare for first-lane); for Metal assert `simd_ballot`/`popcount` (+ `simd_is_first` for `WaveIsFirstLane` — that one is correct). Also re-anchor the guarded atomic to the coverage slot (bind the lane-count result id to the atomic value operand, like the SPIR-V test's `%[[LC0]]` capture) — de-anchoring `atomicAdd{{.*_slang_coverage.*int(N)}}` into a bare `atomicAdd` + separate slot access-chain lets the atomic match any buffer.

**Companion gap (same PR class):** a per-target gate like `isCoverageWaveAggregationSupported` may read the HLSL profile from `targetRequest->getOptionSet().getProfileVersion()` instead of the merged `TargetProgram` set (cf. `slang-parameter-binding.cpp` using `getTargetProgram()->getOptionSet()`; `slang-target-program.cpp` does overrideWith/inheritFrom). CLI `-profile sm_6_0` works, but an API/component-level profile can leave the per-target set `Unknown` → silent fallback to per-lane on SM6.0+ (correct-but-slower, not a miscompile). And HLSL SM6.0+ aggregation often ships untested because every coverage test compiles at `cs_5_0` (per-lane) — add a `cs_6_0` FileCheck. Both Reviewer A (correctness) and Reviewer C (clarity) independently flagged the HLSL-untested + CUDA/Metal de-anchor issues, confirming the pattern.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780935575501-coverage-wave-aggregate-tests-cuda-metal-filecheck.md`_
