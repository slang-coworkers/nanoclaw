---
type: chain
title: slang#13676 — SPIR-V `float(sign(x))` emits a redundant FToS→SToF round-trip
description: "HildarTheDorf, human-filed missed-optimization report: SPIR-V sign() on float lowers to FSign + OpConvertFToS (opaque spirv_asm in hlsl.meta.slang), so float(sign(x)) adds OpConvertSToF even at -O3. Dispatched to slang-triager 10-15 ~18:50Z."
---

# slang#13676

**2026-10-15 18:44Z, webhook `issue_opened`.** Live read before dispatching: OPEN, 0 comments, no
labels, no assignee, human-filed by HildarTheDorf (Vulkan SDK 1.4.363.0 user, not the
albertrodriguezclo batch). Live body matches the payload. The only session on
`gh-issue-shader-slang/slang-13676` was this Main webhook session.

Orchestrator receipt at master 6597ec9202: the SPIR-V case of `sign` in
`source/slang/hlsl.meta.slang` (scalar ~:15826, vector ~:15852) is an opaque `spirv_asm` block that
emits `FSign` then `OpConvertFToS` to honor HLSL's `int` return type. The caller's `float(...)` then
adds `OpConvertSToF`, and IR passes can't see through `spirv_asm`, so no peephole can fold it.
Folding `SToF(FToS(y))` → `y` is not value-preserving in general (`sign(-0.0)`: FSign gives -0.0,
the round-trip gives +0.0; NaN), which the triager should weigh.

Dispatched to `slang-triager` on `gh-issue-shader-slang/slang-13676`. R6 (#13596) wait-on-human
issues is still a pending operator decision, so routing is unchanged.

**18:48Z, triager progress (msg 8):** reproduced on the local master build (FSign → OpConvertFToS → OpConvertSToF, both vector and scalar); now checking the -0.0/NaN semantics and which layer owns the fix. Progress only, not a report, so no reply sent.

**20:18Z, [Triage] (msg 10, memo `/workspace/inbox/a2a-1792095536697-vgua80/triage-13676.md`).** Enhancement
(missed optimization) / low / P3, IR core-module lowering + peephole, SPIR-V. Not a dup; related #12405 (ruling:
sign-of-zero-changing folds are fast-math-only) and its draft PR #12713. Verified on GitHub: comment
[6201414239](https://github.com/shader-slang/slang/issues/13676#issuecomment-6201414239) (20:17:31Z,
nv-slang-bot, includes a verified workaround), `reproduced` label, Type left blank, no assignee.
- Triager's semantics finding: the round-trip IS correct HLSL semantics (DXC `TranslateSign`: sign(-0)=sign(NaN)=0).
  FSign never returns NaN, so my NaN-UB concern doesn't apply. Exact rewrite: `float(int(FSign x)) == FSign(x) + 0.0`
  bit-for-bit, and spirv-opt already drops the `+0.0` at -O1+.
- Recommended A: split SPIR-V `sign` into a `[KnownBuiltin]` FSign helper + IR-visible float→int cast, plus a peephole
  (`v` under fast, `v + 0.0` otherwise). B = new `kIROp_FSign` (heavy), C = upstream SPIRV-Tools rule.
- **Side finding, Main-verified 20:2xZ** (Release build at master 6597ec9202): GLSL-language input `r[1] = sign(x)/2;`
  compiles to FSign → ConvertFToS → **OpSDiv %int** → ConvertSToF, so x<0 gives 0, not -0.5. `glsl.meta.slang` has
  no float `sign`. Correctness bug, unfiled; no existing issue found by search. (#13673 "add `sign` to slang.numerics"
  is unrelated.)
- **Disposition:** parked on maintainer direction for A. Triager one-shot re-check `t-5cb2f6` on 10-22
  (triager-owned, not visible from Main's `ncl tasks`). Two operator decisions open: (1) GO on A to slang-fixer now,
  default wait; (2) file the GLSL `sign` bug, default unfiled.

**Resumes on:** a human comment on #13676, the operator's answer, or the 10-22 re-check.

**10-16 08:04Z, triager GPU re-verification (msg 16), after the operator's GPU-restored notice.** The triager reports,
on the L40S: on Vulkan, `float(sign(x))` and bare FSign agree for -0.0, ±0, ±1.5, NaN, ±Inf and denormals; this driver
returns +0.0 for FSign(-0.0). On CUDA, NaN gives +1.0. The spec still allows FSign(-0.0) = -0.0, so approach A stands.
The GLSL-mode `sign(x)/2` bug is confirmed on the GPU (x=-3 gives 0, not -0.5). Main-verified: comment 6201414239
edited in place at 08:04:28Z, "no GPU needed" removed and GPU results added. Issue still open, 1 comment. The two
operator decisions are unchanged.
