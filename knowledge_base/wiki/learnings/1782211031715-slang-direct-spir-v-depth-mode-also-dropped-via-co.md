---
title: "Slang direct-SPIR-V depth mode ALSO dropped via conflict-branch (dual depth-affecting vars) — not just GLSL"
type: learning
topic: slang-compiler
source: learnings/1782211031715-slang-direct-spir-v-depth-mode-also-dropped-via-co.md
---

# Slang direct-SPIR-V depth mode ALSO dropped via conflict-branch (dual depth-affecting vars) — not just GLSL

Correction/addition to the earlier learning "Slang SV_Depth{Greater,Less}Equal: direct SPIR-V correct, GLSL/via-GLSL drops directional mode" (slang #11691). The direct SPIR-V path is NOT unconditionally correct — it drops the directional `DepthGreater`/`DepthLess` (emitting only `DepthReplacing`) when a single fragment entry point references **two depth-affecting builtin vars with different modes**.

**Reproduced (TOT, direct `-target spirv`):**
```slang
struct FSOut { float a : SV_Depth; float b : SV_DepthGreaterEqual; };
[shader("fragment")] FSOut fmain() { FSOut o; o.a = 0; o.b = 0.5; return o; }
```
→ emits `OpExecutionMode DepthReplacing` only (DepthGreater dropped). A LONE `SV_DepthGreaterEqual` emits both correctly.

**Mechanism:** `maybeEmitEntryPointDepthReplacingExecutionMode` in `slang-emit-spirv.cpp:5957-5961`. It folds the per-var modes from `getDepthOutputExecutionMode`; a plain `SV_Depth` (→DepthReplacing, :5894) or a written `SV_Position`/`gl_FragCoord` (→DepthReplacing, :5882-5891) conflicts with `SV_DepthGreaterEqual` (→DepthGreater). The `else if (mode != thisMode)` branch collapses to `DepthReplacing`, dropping the directional hint (only the unconditional DepthReplacing survives).

**Triage lessons:**
- When a reporter says "directional depth mode missing" on the DIRECT path and a lone-directional shape works for you, suspect a SECOND depth-affecting output in their real shader (their minimal snippet may omit it). Ask for the complete self-contained shader — a reconstructed repro that omits the second var will falsely "not reproduce."
- A maintainer's "newer version doesn't reproduce" is often the lone shape too — confirm WHICH shape they tested before treating it as a version fix. Here v2026.7.1, v2026.11 (7432ffa4e), and master all have the byte-identical conflict branch — version-independent.

**Open design question (unsettled as of 2026-06-23):** should directional-vs-plain let the directional win (DepthReplacing is emitted unconditionally anyway → you'd get both, spec-correct), or should writing both SV_Depth and a directional depth be a diagnostic (contradictory shape)? Only DepthGreater-vs-DepthLess is a true irreconcilable conflict.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782211031715-slang-direct-spir-v-depth-mode-also-dropped-via-co.md`_
