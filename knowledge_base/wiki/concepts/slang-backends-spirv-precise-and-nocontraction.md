---
title: "Slang SPIR-V: `precise`, NoContraction, and floating-point reassociation"
type: concept
group: slang-backends
tags: [spirv, precise, NoContraction, fp-mode, reassociation, spirv-opt, dxc, glslang, computePreciseInsts]
source_count: 7
---

# Slang SPIR-V: `precise`, NoContraction, and floating-point reassociation

How the direct SPIR-V emitter marks floating-point math as non-reassociable, why default fp-mode intentionally emits no `NoContraction`, and how reference compilers disagree on `precise`. spirv-opt pipeline detail is on [[wiki/concepts/slang-backends-spirv-spirv-opt-and-optimization-levels.md]].

## TL;DR

- Direct SPIR-V emits `NoContraction` only for `-fp-mode precise` (#11933, PR #11935 at the `emitArithmetic` choke point; first shipped in v2026.13).
- Default fp-mode emitting NO `NoContraction` is INTENTIONAL and pinned by `//DEFAULT-NOT: NoContraction`, so reassociation-precision reports get an advisory with the `-fp-mode precise` workaround, never a unilateral default flip.
- A float result wrong at default opt but right at `-O0` or `-fp-mode precise`, with `-dump-ir` unchanged ⇒ spirv-opt reassociation (#12160); its add/sub folding rules honour `NoContraction` via `IsFloatingPointFoldingAllowed()`.
- The `precise` qualifier was ignored in default fp-mode (#12198): `isFloatingPointModePrecise` reads only the global `-fp-mode`, and `IRPreciseDecoration` sits only on directly qualified insts. PR #12208 propagates precise-ness to compiler temps in the SPIR-V emitter (locals only); PR #13290 adds entry-point outputs.
- Still unmarked on v2026.20 (#13324): math under `dot`/`mul`, a precise value from a `[noinline]` callee or its caller-side arguments, a precise return type, a precise twin that CSE merges with a plain expression, and a VS `precise SV_Position` fed by `mul`.
- Stale-version triage (#12285): count the symptom on the reporter's version and on HEAD, run `git merge-base --is-ancestor <fix> <release-tag>`, and resolve without a PR if already fixed. `[noinline]` "working" is only a driver optimization barrier.
- Reference compilers (DXC→DXIL, DXC→SPIR-V, glslang) disagree on `precise` at call boundaries, so name the backend you match.
- Slang's `computePreciseInsts` walk dead-ends at `spirv_asm` intrinsics (`dot`, `mul`, `mad`), loses the decoration in CSE, and over-marks every store into a shared buffer root; tests need separate in/out buffers.
- Count `OpDecorate .* NoContraction`, never a bare grep: spirv-asm output also comments `; NoContraction` on instruction lines.

## Emitting NoContraction

`slang-emit-spirv.cpp` never emitted `NoContraction`, so `-fp-mode precise` did nothing on `-target spirv` (#11933) ([direct SPIR-V emitter never emits NoContraction](../learnings/1783064216848-slang-direct-spir-v-emitter-never-emits-nocontract.md)). PR #11935 fixed this by emitting it at the `emitArithmetic` choke point ([emit NoContraction at emitArithmetic](../learnings/1783067747847-slang-direct-spir-v-emit-nocontraction-for-fp-mode.md)).

**Stale-version dup (#12285).** A report that "precise compensated summation is wrong unless the helper is `[noinline]`" on v2026.12 is a dup of #11933: fix commit `33f9ed0c` first shipped in v2026.13. Method: count the symptom on the exact repro (`grep -c NoContraction`: 0 on 2026.12, 32 at HEAD); run `git merge-base --is-ancestor <fix> <tag>`; refute the per-function theory (fp-mode is target-scoped; `[noinline]` "worked" only because `OpFunctionCall` is a driver optimization barrier). Resolve without a PR. `NoContraction` belongs on the surrounding `OpFAdd`s, not on a fused `Fma` ([#12285 = stale-version dup of #11933](../learnings/1785415514440-12285-stale-version-dup-of-11933-spir-v-precise-no.md)).

## The `precise` qualifier in default fp-mode

**`precise` qualifier in default fp-mode (#12198, distinct from #12285; fixed by PR #12208, merged 2026-09-23).** Before the fix it produced 0 `NoContraction` and spirv-opt reassociated, because `isFloatingPointModePrecise` reads only the global `-fp-mode` and never reads `IRPreciseDecoration`. `-O0` preserves order and `-fp-mode precise` yields 16 `NoContraction`, so that was the lever. `IRPreciseDecoration` sits only on directly qualified insts, not compiler temps, so the fix propagates precise-ness backward through the FP fan-in before `maybeEmitNoContraction` ([precise ignored in default fp-mode](../learnings/1784785437426-precise-qualifier-ignored-on-direct-spir-v-in-defa.md)). PR #12208 does this in the SPIR-V emitter (`computePreciseInsts`) and covers function-local values only; PR #13290 (#13287) extends the seeds to precise entry-point outputs, described on [[wiki/concepts/slang-backends-glsl-entry-point-and-varying-legalization.md]].

**What is still unmarked on v2026.20 (#13324).** Measured 2026-10-19 with release slangc v2026.20 (v2026.19 is the same), `-target spirv-asm`, counting `OpDecorate .* NoContraction`. Covered: `precise float r = a*b + c*d;` gets 3/3, and a precise local inside an inlined callee marks the callee's math. Zero decorations for: `dot(a*b+c, d)` and `mul(m, a*b)` (the walk stops at `spirv_asm` intrinsics, and `OpDot`/`OpVectorTimesMatrix` are not in the opcode list); a VS `precise float4 pos : SV_Position = mul(mvp, mul(world, p))`, while the NON-precise `uv` output oddly gets 2; a precise result computed in a `[noinline]` callee; `float x = a*b+c; precise float y = a*b+c;`, where CSE merges the two and drops the decoration; and a precise return type `precise float f() { return a*b+c; }`. Caller-side argument math is never marked when the precise value lives in a non-inlined callee. Harness: small compute/vertex shaders through `slangc X.slang -target spirv-asm -entry main -stage compute -o -`, grep `OpDecorate .* NoContraction`; release tarballs are at `https://github.com/shader-slang/slang/releases/download/v<ver>/slang-<ver>-linux-x86_64.tar.gz` ([remaining precise/NoContraction gaps on v2026.20](../learnings/1792405639060-precise-nocontraction-on-v2026-20-remaining-gaps-a.md)). The downstream reassociation itself is covered next.

## Downstream reassociation in spirv-opt

**Float reassociation is spirv-opt, not Slang IR (#12160).** `[ForceUnroll]` + default opt folded `(xmax - xmin)` into an inexact constant. The add/sub folding rules regroup `(a-b)-(b-k)` → `(a-b)+C`, and every such rule is gated on `IsFloatingPointFoldingAllowed()`, which honours `NoContraction`. A regression test pins the default-mode absence of `NoContraction` (`//DEFAULT-NOT: NoContraction`, #11933). Treat this as "default is more permissive than users expect". Send an advisory with the `-fp-mode precise` workaround and escalate the design question ([float reassociation = downstream spirv-opt](../learnings/1784504993349-slang-spir-v-float-reassociation-precision-bug-dow.md)).

## Reference compilers and the `computePreciseInsts` walk

**Reference compilers disagree on `precise`, and Slang's `computePreciseInsts` walk has three gaps (#13324).** Measured 2026-09-29 with the in-tree compilers: DXC→SPIR-V by dlopen-ing `build/Release/lib/libdxcompiler.so` (it has SPIR-V CodeGen) and calling `IDxcCompiler3` with `-spirv -O0 -fcgl`; DXC→DXIL via `slangc -pass-through dxc -target dxil-asm`; glslang via `glslang_compile_1_2` in `libslang-glslang` (harnesses `dxcspv.cpp`/`gl2.cpp` in `/workspace/agent/scratch-13324`). At call boundaries the references disagree. When a caller's `precise` result comes from a non-inlined callee, only DXC→DXIL marks the callee's math (it has inlined by then); glslang and DXC→SPIR-V leave it unmarked. A callee's `precise` local marks the caller's argument math in both DXC backends but not in glslang. DXC→DXIL also ignores `precise` on static/groupshared globals, a helper's `out precise` param, a helper's `precise` return type, and a reassigned `precise in` param, all of which DXC→SPIR-V and glslang honor. So "match DXC" is not one target; name the backend. In Slang (master 214064dd1) the backward walk `computePreciseInsts` dead-ends at intrinsics lowered via `spirv_asm` (`dot`, `mul`, `abs`, `mad`→Fma), so `dot(a*b+c, d)` gets 0 `NoContraction` where DXC gets 3, and its op filter also excludes `OpDot`, `OpMatrixTimes*` and `OpVectorTimesMatrix`. CSE drops the decoration (`removeAndDeallocate` in `slang-ir-redundancy-removal.cpp` does not transfer it). And the walk goes from a load to the buffer root and then to every store into that buffer, so unrelated outputs in the same `RWBuffer` get marked; tests need separate in/out buffers. Counting pitfall: spirv-asm output also comments `; NoContraction` on instruction lines, so count `OpDecorate .* NoContraction`, not a bare grep ([precise/NoContraction: reference compilers disagree at call boundaries; Slang's walk dead-ends at spirv_asm intrinsics](../learnings/1790706758785-precise-nocontraction-reference-compilers-disagree.md)). For `precise` lost on entry-point out params and struct fields (#13287), see [[wiki/concepts/slang-backends-glsl.md]].

## See also

- [[wiki/concepts/slang-backends-spirv.md]] — emitter overview: entry points, builtin variables, descriptor-heap specialization, VariablePointers, atomics
- [[wiki/concepts/slang-backends-spirv-debug-function-info.md]] — DebugFunction / DebugFunctionDefinition records
- [[wiki/concepts/slang-backends-spirv-spirv-opt-and-optimization-levels.md]] — slang-glslang loading, -O levels, spirv-opt aborts, folding/unroll/CSE limits
- [[wiki/concepts/slang-backends-spirv-debug-info-emission.md]] — -g levels, DebugSource/DebugLine, debug types and variables, OpName
- [[wiki/concepts/slang-backends-spirv-capabilities-and-version-gating.md]] — capdef atoms, capability/extension emission, version header, `[require]` enforcement
- [[wiki/concepts/slang-backends-spirv-descriptor-handles-and-heap.md]] — DescriptorHandle load coalescing, NonUniform, bindless width, descriptor-heap ABI
- [[wiki/concepts/slang-backends-spirv-entry-points-varyings-and-execution-modes.md]] — varying locations, shared Input vars, depth/topology modes, `spirv_asm` execution modes
- [[wiki/concepts/slang-backends-spirv-emit-and-legalization-defects.md]] — logical pointers in composites, opaque copies, constant/scalar emit gaps, legalize diagnostics
- [[wiki/concepts/slang-backends-spirv-validation-testing-and-environment.md]] — spirv-val, pre/post-spirv-opt validity, stale binaries, runtime tests, Vulkan CI flakes

**Source learnings (7):**
- [direct SPIR-V never emitted NoContraction (#11933)](../learnings/1783064216848-slang-direct-spir-v-emitter-never-emits-nocontract.md)
- [emit NoContraction at emitArithmetic choke point (PR #11935)](../learnings/1783067747847-slang-direct-spir-v-emit-nocontraction-for-fp-mode.md)
- [#12285 stale-version dup of #11933; check merge-base vs tag](../learnings/1785415514440-12285-stale-version-dup-of-11933-spir-v-precise-no.md)
- [precise ignored in default fp-mode; propagate to temps (#12198)](../learnings/1784785437426-precise-qualifier-ignored-on-direct-spir-v-in-defa.md)
- [precise/NoContraction on v2026.20: remaining gaps after #12208/#13290 (#13324)](../learnings/1792405639060-precise-nocontraction-on-v2026-20-remaining-gaps-a.md) — `dot`/`mul`, `[noinline]` callees, precise returns and CSE-merged twins get 0 decorations; count `OpDecorate .* NoContraction`
- [float reassociation is spirv-opt, gated on NoContraction (#12160)](../learnings/1784504993349-slang-spir-v-float-reassociation-precision-bug-dow.md)
- [precise/NoContraction: DXC→DXIL, DXC→SPIR-V and glslang disagree at call boundaries; `computePreciseInsts` dead-ends at `spirv_asm` intrinsics, loses the decoration in CSE, and over-marks via buffer roots; count `OpDecorate .* NoContraction` (#13324)](../learnings/1790706758785-precise-nocontraction-reference-compilers-disagree.md)
