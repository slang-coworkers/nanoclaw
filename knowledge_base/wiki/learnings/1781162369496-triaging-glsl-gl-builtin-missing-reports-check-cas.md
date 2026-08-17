---
title: "Triaging 'GLSL gl_* builtin missing' reports — check casing, -allow-glsl scope, and the Wave* native equivalent first"
type: learning
topic: slang-compiler
source: learnings/1781162369496-triaging-glsl-gl-builtin-missing-reports-check-cas.md
---

# Triaging "GLSL gl_* builtin missing" reports — check casing, -allow-glsl scope, and the Wave* native equivalent first

When a user reports a GLSL builtin like `gl_SubgroupID` is "missing" in Slang (e.g. shader-slang/slang#11548), it is usually NOT a real gap. Check three things before treating it as a feature request:

1. **Casing.** GLSL identifiers are case-sensitive. Users frequently write `gl_SubGroupID` (capital G) instead of the real `gl_SubgroupID` (lowercase "group"), which yields an "undeclared identifier" error.
2. **GLSL-compat module scope.** The `gl_*` builtins live in `source/slang/glsl.meta.slang` and require the `-allow-glsl` option with target `glsl` or `spirv`. From regular Slang/HLSL-style code they're not in scope.
3. **The portable native equivalent.** Slang exposes these as HLSL-style Wave intrinsics in `hlsl.meta.slang`, which work across SPIR-V/HLSL/CUDA/Metal/WGSL:
   - `WaveGetWaveIndex()` ≡ `gl_SubgroupID`  (hlsl.meta.slang:17255; spirv→`OpLoad builtin(SubgroupId)`; added by merged PR #11192, 2026-05-18)
   - `WaveGetNumWaves()` ≡ `gl_NumSubgroups` (:17224)
   - `WaveGetLaneCount()` ≡ `gl_SubgroupSize`, `WaveGetLaneIndex()` ≡ `gl_SubgroupInvocationID`

The full `gl_Subgroup*` family (incl. EqMask/ballot) is defined in glsl.meta.slang ~:7283-7321, each as a `public property` delegating to a `Wave*` intrinsic with `[require(glsl_spirv|..., subgroup_basic)]`.

Related: #8913 (open) tracks a *true* `SV_GroupWaveIndex` system-value semantic with hardware guarantees (vs. the current `groupIndex/WaveGetLaneCount()` computation on HLSL/CUDA); #3522 (closed) is the historical umbrella request; #11303 (open) notes WaveGetWaveIndex/WaveGetNumWaves emit spec-invalid SPIR-V in ray-tracing stages (fine for compute).

**Tooling caveat:** DeepWiki was inconsistent here — it first confidently claimed all four subgroup builtins exist, then hedged in a follow-up. The authoritative answer came from reading glsl.meta.slang / hlsl.meta.slang directly. Always verify "does builtin X exist" against the meta.slang sources at HEAD, not DeepWiki alone.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781162369496-triaging-glsl-gl-builtin-missing-reports-check-cas.md`_
