---
type: chain
title: slang#13737 — HLSL/DXIL Load/GetDimensions on combined texture-samplers emit an extra sampler argument
description: Human-filed (Buriola) emit bug, same root cause as #10522; draft PR #13741 extends #11816's `$q` marker; waiting on peer review and the operator's follow-up filing call
---

# slang#13737 — combined texture-sampler: texture-only ops keep the sampler operand

- Filed 2026-10-17 by Buriola. Texture-only ops on `Sampler2D`/`Sampler2DArray` (`Load`, `GetDimensions`,
  `operator[]`) emit `tex.Op(sampler, …)` on HLSL, so DXC rejects them. SPIR-V/GLSL are fine.
- 15:43Z dispatched to slang-triager on `gh-issue-shader-slang/slang-13737`. 15:49Z I sent prior art:
  PR #11816 (merged 08-18, closed #11669, WGSL only) added the `$q` skip-injected-sampler marker for
  `GetDimensions`.
- 15:55Z triage comment posted (bot; issuecomment-6236169441); labels `reproduced`, Type=Bug, P2.
  Triager's findings: reproduced on master 60a7c8c88. HLSL `Load`/`operator[]`/`GetDimensions` are bare
  `.Name` member intrinsics, and `$q` cannot reach them. WGSL/Metal `Load`/subscript are also broken (the
  sampler is used as the coordinate). `Sampler2DMS`/`Sampler2DShadow` (#10522, open, no assignee) are the
  same bug. Recommended A: forward through `__extractImage(this)` behind `isCombined`; fallback B: extend `$q`.
- Fixer session `sess-1792252474641-muhgh6` (slang-fixer); `pr-mappings` row for #13741 points to it.
- 10-18 ~00:29Z **DRAFT PR #13741** @45d7d9f, `pr: non-breaking`, `Fixes #13737` + `Fixes #10522`.
  The fixer reports (I have not verified this) that it used **B**: A hits E30027 inside the generic
  extension (generic inference unifying a type with itself), and patching inference caused E55201 plus
  a crash with WGSL bindless combined samplers. Still one mechanism. Fixer's numbers: gh-13737 7/7
  incl. DXC; full suite 10929/10932 (the 3 fp8 CUDA failures also fail on master); SPIR-V/GLSL/plain-
  texture/CPU output byte-identical to master. CI started; peer review asked of slang-reviewer.
- 10-18 02:17Z **slang-reviewer R1 = REQUEST_CHANGES** @45d7d9f0a (0 bugs, 2 gaps, 1 question; diff_hash
  4c1f2175…). Sent straight to the fixer (seq 16/18/20); I received a copy. Reviewer's own runs (facts): fix
  correct, no regressions, 526-file x 7-target corpus diff = only 14 combined-sampler fixes, WGSL GPU-run on
  L40S OK. Required change = maintainer R1 (aidanfnv, #10522 comment 4071794281: resolve via
  `__getTexture()`). The member spelling `__extractImage(this).Load` does fail with E30027, but a
  **free-function trampoline** (`__loadTexture(__extractImage(this), loc)`, like `__texture_gather`)
  compiles with no inference change and also fixes Devin's pre-existing CPU combined-`Load` gcc error.
  WGSL keeps `$q`, because the forward ICEs (E99997) on bindless `.Handle`. Gaps: `GetSamplePosition`
  (pre-existing; follow-up 1) and untested Metal/WGSL 1D/3D/cube strings. Clarity: two copies of the
  `$q` mapping, CPU scope wording, PR body not in the five-part format. The fixer is iterating; I dispatched nothing.
- **Unfiled follow-ups, operator call (asked 10-18 ~00:55Z):** (1) `Sampler2DMS.GetSamplePosition`,
  (2) plain `Texture2DMS[uint2]`, (3) the generic-inference E30027 bug. Dedup search on 10-18 found no
  existing issues. Triager is holding all three.
- Draft-vs-ready also goes to the operator; never put "ready is fine" in a brief (see the drafts-only
  guardrail).
- Follow-up 3 may be weaker after R1: the trampoline compiles, so E30027 may only be a limit of member-call
  inference inside a generic extension, not a general bug. I told the operator on 10-18 02:2xZ.
- **Resumes on:** the fixer's R2 push, then re-review, [Fix Report] and [Triage Resolution]; #13741 webhooks;
  the operator's answer on follow-ups.
