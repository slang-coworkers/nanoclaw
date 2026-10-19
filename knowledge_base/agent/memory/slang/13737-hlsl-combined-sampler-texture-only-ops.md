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
- 10-18 ~05:25Z **R2 pushed** @68f06ed8d (draft, 11 commits; new tests `gh-13737-bindless`, `gh-13737-cpu`).
  The fixer reports, through the triager (I checked the head, draft state, file list and issue comment
  6243760176 updated 05:25Z): HLSL and CPU forward `Load`, the subscript and `GetDimensions` to
  `__extractImage(this)` through free-function trampolines (no type-checker change). Metal and WGSL keep
  one `$q` rule. Full suite 10938/10941 (the 3 fp8 CUDA failures also fail on master). The CPU combined
  `Load` fix is included. R2 review request sent; this is the last round (cap).
- 10-18 06:59Z **slang-reviewer R2 = APPROVE_WITH_NITS** @68f06ed8d (0 bugs, 11 gaps, 3 questions; diff_hash
  ab3058f1…). Reviewer's own runs: R1 (aidanfnv) and R3 (jhelferty-nv) both met. No `$q` is left on any HLSL
  path. Suite 10923/10941, the same 18 failures as master in its container, 0 regressions. 528x7 corpus:
  only fixes. DXC 0 errors on all probe sets; NonUniform preserved; L40S Dawn and vk/cuda runtime pass;
  the mutation drill catches a missing `$q`. Devin's CPU flag is fixed (the Devin page is stale). Nits: dead
  bindless `-NOT` check, vacuous HLSL fold row, non-2D `GetDimensions` forwarders not pinned by a test,
  a misplaced `$q` is now an ICE (N1), CPU `Load(loc, offset)` is pre-existing (N2). The reviewer
  suggests a tracking issue for E30027 (= follow-up 3).
- CI: `workflow_dispatch` run 39099986886 @68f06ed is `waiting` on the **`falcor-ci`** environment gate
  (`can_approve=false` for the bot). Only the small checks have run (REUSE, CLA, board-sync pass). A human
  must approve it.
- 10-18 07:23Z **nits pushed** @ce23b34d9 (draft, +552/−76, 12 files). 3 commits after R2. I checked the delta:
  comments and docs, tighter tests, a rename of `m_skipsSplitSamplerArg`, and the `$p` assert now checks
  `startsWith("$q")`. No logic change. 07:35Z **[Triage Resolution] = Fixed** (msg 48; msg 50 is a duplicate).
  Fixer's numbers: PR tests 23/23, full suite 10941/10944 on the L40S (run before two comment-only edits),
  DXC 10/10 probes. Issue artifact: fixer comment 6243760176 (current).
- CI @ce23b34: `workflow_dispatch` 39107456646 is `waiting` on **`falcor-ci`** (`can_approve=false`).
  39099986886 @68f06ed was cancelled when the new head was pushed.
- Follow-ups grew to **5** (msg 48): adds (4) bindless DXIL `nonUniformIndex=false` (pre-existing; plain
  `Texture2D.Handle` too) and (5) CPU prelude float-array `GetDimensions` (pre-existing; plain textures too).
  Dedup 10-18 07:4xZ: no existing issues for 4 and 5.
- **Unfiled follow-ups, operator call (asked 10-18 ~00:55Z):** (1) `Sampler2DMS.GetSamplePosition`,
  (2) plain `Texture2DMS[uint2]`, (3) the generic-inference E30027 bug. Dedup search on 10-18 found no
  existing issues. Triager is holding all three.
- Draft-vs-ready also goes to the operator; never put "ready is fine" in a brief (see the drafts-only
  guardrail).
- Follow-up 3 may be weaker after R1: the trampoline compiles, so E30027 may only be a limit of member-call
  inference inside a generic extension, not a general bug. I told the operator on 10-18 02:2xZ.
- **Parked on humans:** falcor-ci approval, the ready flip (operator), filing the 5 follow-ups (operator), and
  maintainer review. One-shot re-check `rechase-13737-pr13741-a71d` on 10-21 08:00Z (duplicate `-f5e0` cancelled).
- **Resumes on:** #13741 webhooks (CI, review, merge), the operator's answers, or the one-shot.
