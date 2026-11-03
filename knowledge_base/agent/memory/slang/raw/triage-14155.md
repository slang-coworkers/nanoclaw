---
type: triage
description: C-like emit writes INT64_MIN as -9223372036854775808LL (Metal/HLSL/CUDA/C++) — warning on plain use, HARD error as a switch case label (nvrtc/dxc; glslang via GLSL override). Reporter has a fix prepared (Int64 case only).
---
# Triage: shader-slang/slang#14155 — C-like targets: the most negative `int64_t` is emitted as `-9223372036854775808LL`
Date: 2026-11-02T10:20Z | bug | medium | P2 | target-emit (C-like shared: Metal/HLSL/CUDA/C++; + GLSL override)
Reporter: albertrodriguezclo (external). R6 hold to 2026-11-06T10:04:28Z. Duplicate: no.

## What's broken
`CLikeSourceEmitter::emitSimpleValueImpl` prints a signed 64-bit literal as `<decimal>LL`. For INT64_MIN that is
`-9223372036854775808LL` = unary minus on `9223372036854775808LL`, which does not fit `long long`.
Plain use: warning (Metal -Wconstant-conversion; clang -Wimplicitly-unsigned-literal; g++ "so large that it is unsigned"); value correct.
**Switch `case` label: hard error** (not in the issue) — the case selector goes through the same path:
- nvrtc 12.6 (`-target ptx`): `invalid narrowing conversion from "unsigned long long" to "long long"`.
- dxc 1.9 (`-target dxil`): `case value is not a constant expression` / `value 9223372036854775808 is outside the range`.
- glslang (`-emit-spirv-via-glsl`): `'case' : scalar integer expression required` (GLSL override spells `-9223372036854775808L`).
- CPU `-target host-callable` (LLVM 21.1): `case value evaluates to 9223372036854775808, which cannot be narrowed to type 'long'`; `-target shader-sharedlib` (gcc 12.2): warning only.

## Repro (local, Release build 3649fb982; emitter lines unchanged at HEAD 6815ed82d)
Files in /workspace/agent/scratch-14155/: i64min.slang (issue repro), sw.slang (switch case), iptrmin.slang (IntPtr + switch), lit.cpp/lit2.cu (spellings).
```
slangc i64min.slang -target {metal,hlsl,cuda,cpp} -entry computeMain -stage compute -line-directive-mode none   # -> -9223372036854775808LL
slangc sw.slang -target ptx  -entry computeMain -stage compute     # nvrtc ERROR
slangc sw.slang -target dxil -profile cs_6_0 -entry computeMain    # dxc ERROR
slangc sw.slang -target spirv -emit-spirv-via-glsl -entry computeMain -stage compute   # glslang ERROR
```
Metal toolchain not runnable here (Linux); Metal reproduced at text level only (identical string).
Fixed spelling `(-9223372036854775807LL - 1LL)` verified: clang++/nvcc clean (lit2.cu), dxc compiles the hand-patched sw.hlsl case label.
GLSL fixed spelling `(-9223372036854775807L - 1L)` NOT verified (no standalone glslang; slangc -pass-through glslang hits "no matching IR symbol").

## Codebase digest (HEAD 6815ed82d)
- `source/slang/slang-emit-c-like.cpp:1380-1385` `BaseType::Int64`: `emitInt64(v)` + `"LL"`. The bug.
- `slang-emit-c-like.cpp:1394-1409` `BaseType::IntPtr` (64-bit ptr): `int64_t(` + `emitInt64(v)` + `)`, no suffix → `int64_t(-9223372036854775808)` — same out-of-range literal (clang/g++ warn). **Not covered by the reporter's Int64-only fix.**
- `slang-emit-c-like.cpp:1367-1373` `BaseType::Int`: `int(-2147483648)` for INT32_MIN — fine on LP64 (2147483648 is `long`); hypothesis: MSVC C4146 / 32-bit-long hosts; out of scope.
- `slang-emit-c-like.cpp:3697-3706` `emitSwitchCaseSelectorsImpl` → `emitOperand` → IntLit FoldPolicy::Always → `emitSimpleValue` — why case labels hit it.
- `slang-emit-source-writer.cpp:194/206-211` `emitInt64` = `snprintf("%" PRId64)`; no special case.
- Overrides: HLSL (`slang-emit-hlsl.cpp:1759`), Metal (`slang-emit-metal.cpp:1232`), CPP (`slang-emit-cpp.cpp:1058`) override only FloatLit; CUDA inherits CPP → all four use the base Int64 case.
  **GLSL overrides** `slang-emit-glsl.cpp:1415-1422` (`IntPtr`+`Int64` → `<decimal>L`) → same bug, **not covered by the reporter's fix**.
  WGSL `slang-emit-wgsl.cpp:1136-1141` → `i64(-9223372036854775808)`; WGSL has no i64, out of scope.
- No prior emitter fix (git log -S INT32_MIN/INT64_MIN/`2147483647 - 1` → nothing). Front-end INT64_MIN fixes: #9330 (parser negation), #11357 (literal typing, fixed #11216).
- Tests named in the issue: integer-corners-i64.slang (vk direct only — never hits C-like on CI), conversion-to-bool.slang / conversion-to-int64.slang (have -metal, -cuda, -cpu, -dx12 lanes). `tests/language-feature/constants/int64-min-literal-emit.slang` does not exist yet.

## Candidate approaches
### A: Reporter's fix — special-case INT64_MIN in `BaseType::Int64` only
- Where: slang-emit-c-like.cpp:1380-1385. Delta: `(-9223372036854775807LL - 1LL)`; fixes plain use + case labels on Metal/HLSL/CUDA/C++.
- Tradeoffs: smallest diff. Leaves IntPtr (:1394) and GLSL (glsl.cpp:1415) broken. Risk: low.
### B: A, generalized to every signed-64 site via one helper (recommended)
- Where: a small helper (e.g. on CLikeSourceEmitter or SourceWriter) that writes `(-9223372036854775807<sfx> - 1<sfx>)` for INT64_MIN, else `<decimal><sfx>`; called from c-like Int64 (`LL`), c-like IntPtr 64-bit (`LL` inside `int64_t(...)`), GLSL Int64/IntPtr (`L`).
- Tradeoffs: one source of truth; +2 call sites. GLSL spelling needs a glslang check (CI -vk via GLSL lane). Risk: low.
### C: Bit-pattern spelling `int64_t(0x8000000000000000ULL)`
- Delta: explicit cast of an in-range unsigned literal. Tradeoffs: unsigned→signed out-of-range conversion is impl-defined before C++20 (two's-complement everywhere in practice); less readable in output; GLSL needs `int64_t(0x8000000000000000UL)`. Risk: low-medium.
### Rejected: `INT64_MIN`/`LLONG_MIN` macro — not available in Metal/HLSL/GLSL without per-target prelude changes.

## Recommended path (solution brief)
- **Hypothesis (fact, verified):** signed-64 literal printers emit the negated out-of-range decimal for INT64_MIN.
- **Files:** slang-emit-c-like.cpp:1380-1385 (Int64), :1394-1409 (IntPtr 64-bit); slang-emit-glsl.cpp:1415-1422 (Int64/IntPtr).
- **Repro:** `slangc sw.slang -target ptx|dxil` (hard errors) and `-target metal|cpp` text grep for `9223372036854775808`.
- **Accept:** no `9223372036854775808` in metal/hlsl/cuda/cpp/glsl output for INT64_MIN (assignment, IntPtr, switch case); nvrtc/dxc/glslang compile a `case INT64_MIN:`; cpu run + `-cuda` run (L40S) of a switch on INT64_MIN selects the right arm; existing conversion-to-int64/-bool tests pass.
- **Recommended:** B — the reporter's spelling, applied at all three sites. Reporter owns the fix (says fix prepared; usually opens own PR) → NOT handed to slang-fixer (parent order).
- Suggest to reporter (post-hold): extend the Int64 fix to IntPtr + GLSL; add a switch-case lane (the hard-error case) and a `-vk -emit-spirv-via-glsl` / `-cuda` run lane.

## Sources
- DeepWiki: emitSimpleValueImpl per-BaseType; GLSL `L` suffix / WGSL `i64()`; case labels via emitSimpleValue (both consistent with local reads).
- Related, NOT duplicate: #13986 (SIGFPE folding INT64_MIN / -1 in SCCP/front end; draft PR #13991), #13994 (spirv-opt fold SIGFPE), #11216/#11357 (front-end literal typing, closed/merged).
- Dup search: `9223372036854775808`, `INT64_MIN`, `int64 min literal`, `2147483648 literal`, `INT_MIN emit` → no duplicate.
- Shared wiki: no prior hit on literal emission (concepts/slang-language-core-integer-constant-folding.md covers #13986 only).
