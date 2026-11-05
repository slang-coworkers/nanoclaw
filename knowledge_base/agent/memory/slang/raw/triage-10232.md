---
type: triage
---
# Triage: shader-slang/slang#10232 — ICE when using `double` type targeting WGSL or Metal
Date: 2026-11-04 | bug | medium | P2 | IR (late pre-emit check) / target-emit (WGSL, Metal)

## What's broken
Any `double` that survives optimization on `-target wgsl` / `-target metal` aborts with E99997
"InternalError unexpected: 'double' type emitted" (exit 254) instead of a user diagnostic.
Reporter (rkoivunen-sw, fuzzed) + skiminki-nv 2026-07-09 (`void f(double v)` + `0.0LF`, PR #12020).
Not a regression: same E99997 on v2026.13.1 (local) and the reporter's v2025.20.

## Repro (master 3da6f63c0, Release build, 2026-11-04)
- a.slang (issue body), b.slang (skiminki), p4 (struct field `double b` in RWStructuredBuffer<S>), p5 (`double d = o[1]; d*=3`),
  p6 (`sqrt(double(x))`), m (double2x2 mul) → all E99997 on wgsl+metal, at default, -O0, -minimum-slang-optimization.
- HLSL/GLSL/SPIR-V/CUDA compile a.slang fine.
- **Must keep compiling (pass on master today, both targets, all opt levels incl. -g):** p1 `(float)(1.5LF)`;
  p2 unused `uniform double`; p3 uncalled `float helper(double)`; p7 `double d = 1.25; o[0] = (float)d;`.
  In all four, no `Double` inst remains in the IR at the end of linkAndOptimizeIR (checked via -dump-ir); in every
  ICE case it does. Sources in "Probe sources" below.

## Codebase digest
- Crash sites (moved from the issue's wgsl:499 / metal:1139): slang-emit-wgsl.cpp:565-567 (type), :1244-1247
  (FloatLit BaseType::Double), slang-emit-metal.cpp:1371-1372 (type; vectors reach it via :1146).
- E56103 int16 precedent is emit-time `diagnoseOnce` with no location (slang-emit-wgsl.cpp:591,594,1114,1119; PR #7692).
- validateVectorsAndMatrices (slang-ir-validate.cpp:719, slang-emit.cpp:2582) = E38203: vectors only, all floats
  (incl. double) allowed; scalars never checked → cannot catch this.
- checkUnsupportedInst(IRModule*) (slang-ir-check-unsupported-inst.cpp:429-509) already scans hoisted global TYPE
  insts per target: VectorType/MatrixType → E55200 `unsupported-builtin-type` (:468), TextureType multisample on
  CUDA → E55215 (:480, PR #12671 — exact template). Called at slang-emit.cpp:2972, but SKIPPED under
  minimum optimization; checkUnsupportedResourceLocals (:2970) always runs.
- No fp64 capability atom (capdef has only fp64 atomics :741/:757); scalar types generated without [require]
  (core.meta.slang:1183-1188). Type-level precedent exists: FloatE4M3/E5M2/BFloat16 `[require(spvFloat8EXT/…)]`
  (core.meta.slang:1760-1792). Double intrinsics (asdouble, packDouble2x32) are already gated off metal/wgsl.
- No pass lowers double for any target. Tests with double DISABLE_TEST metal/wgsl (scalar-double-simple, frexp-double, …).

## Candidate approaches
### A: late IR check on the hoisted DoubleType (recommended)
- Where: slang-ir-check-unsupported-inst.cpp global-inst switch (next to kIROp_TextureType :480), or a small sibling
  pass that runs in both optimization modes (slang-emit.cpp:2970-2972).
- Delta: one located error per module when `double` survives to emit on WGPU/Metal; emitter SLANG_UNEXPECTED sites
  become unreachable invariants. Covers scalar/vector/matrix/struct/array/param/return/literal at once (all use the
  one deduplicated DoubleType inst).
- Tradeoffs: matches master's accept-set exactly (only fires when emit would ICE); location via findFirstUseLoc may
  land on a type user with no sourceLoc → may need a value walk (vars/params/IRCall results first) to point at user code.
- Risk: a DoubleType kept alive by a non-emitted user (decoration, dead hoisted type) would false-positive → full suite.
### B: emitter diagnoseOnce (issue's suggestion)
- Where: the three SLANG_UNEXPECTED sites. Delta: unlocated error at emit, same accept-set.
- Tradeoffs: smallest diff, mirrors E56103; but no source location, emitter must keep emitting a placeholder, 3 sites.
### C: check-time capability gate (`[require(fp64)]` on double, new atom excluding metal/wgsl)
- Delta: precise location at semantic check. Rejected for this bug: rejects p1/p7 (fold away today → regression),
  propagates through every core-module decl mentioning double, misses expression-only types. Design-level, = #4947.
### D: demote double→float on these targets — rejected (silent precision change).

## Recommended path
A — late IR check, both opt modes. Starting point, not a verdict.
- Add `case kIROp_DoubleType:` for isWGPUTarget || isMetalTarget in a check that also runs under
  -minimum-slang-optimization; diagnose once (reuse E55200 or a new "64-bit float not supported on <target>").
- Location: prefer a user-code site (var/param/IRCall result whose type contains double), not line 0.
- Keep emitter sites as assertions (unreachable).
- Test: DIAGNOSTIC_TEST for wgsl + metal (issue repro + 0.0LF param + struct field/matrix), plus a positive run that
  p1/p7-style folded double still compiles.
- Accept when: a/b/p4/p5/p6/m give a located error (no E99997) on both targets at default/-O0/-minimum-slang-optimization/-g;
  p1/p2/p3/p7 still compile; HLSL/GLSL/SPIR-V/CUDA unchanged; full slang-test no new failures.
- Scope: double only. #10234 (int8 on WGSL, same pattern, other assignee) is a natural follow-up, not in this PR.

## Sources
- DeepWiki x2: no type-level capability for double/fp64; per-target type rejection lives in IR checks / emitters.
- Wiki: slang-compiler-unsupported-shape-checks-and-emitter-use-checks (run "cannot be emitted" checks at end of
  linkAndOptimizeIR; earlier placement rejects code master compiles; widen the check in the same PR that removes an ICE).
- #10233: reporter's draft, test-only (tests/bugs/gh-10232.slang, DIAGNOSTIC_TEST without CHECK/expected, wgsl only,
  head d2f99617, stale since 2026-02-27). Would fail before and after a fix as written.
- Related: #10234 (int8 WGSL sibling), #4947 (umbrella: report f64/i8/i16 via capabilities), #14186 (bf16/fp8 WGSL),
  #13356 Risk (double matrix products will hit this abort), #13355 (packDouble2x32 gating), #14062 (double helper on Metal).

## Probe sources (each: slangc X.slang -target wgsl|metal -entry computeMain -stage compute; a.slang uses -entry main)
### a.slang
```slang
RWStructuredBuffer<double> buffer;

[shader("compute")]
[numthreads(1,1,1)]
void main(uint3 tid : SV_DispatchThreadID) {
    buffer[2] = buffer[0] + buffer[1];
}
```
### b.slang
```slang
RWStructuredBuffer<float> outputBuffer;

void storeValue(double   v) { outputBuffer[0] = (float)v; }

[numthreads(1, 1, 1)]
void computeMain()
{
    storeValue(0.0LF);
}
```
### p1.slang
```slang
RWStructuredBuffer<float> o;
[numthreads(1,1,1)]
void computeMain() { float x = (float)(1.5LF); o[0] = x * 2.0; }
```
### p2.slang
```slang
RWStructuredBuffer<float> o;
uniform double unusedD;
[numthreads(1,1,1)]
void computeMain() { o[0] = 1.0; }
```
### p3.slang
```slang
RWStructuredBuffer<float> o;
float helper(double v) { return (float)v; }
[numthreads(1,1,1)]
void computeMain() { o[0] = 1.0; }
```
### p4.slang
```slang
struct S { float a; double b; };
RWStructuredBuffer<S> sb;
RWStructuredBuffer<float> o;
[numthreads(1,1,1)]
void computeMain() { o[0] = sb[0].a; }
```
### p5.slang
```slang
RWStructuredBuffer<float> o;
[numthreads(1,1,1)]
void computeMain() { double d = o[1]; d = d * 3.0; o[0] = (float)d; }
```
### p6.slang
```slang
RWStructuredBuffer<float> o;
[numthreads(1,1,1)]
void computeMain() { o[0] = (float)sqrt(double(o[1])); }
```
### p7.slang
```slang
RWStructuredBuffer<float> o;
[numthreads(1,1,1)]
void computeMain() { double d = 1.25; o[0] = (float)d; }
```
### m.slang
```slang
RWStructuredBuffer<float> o;
[numthreads(1,1,1)]
void computeMain() { double2x2 m = double2x2(o[0],o[1],o[2],o[3]); o[0] = (float)mul(m, m)[0][0]; }
```
