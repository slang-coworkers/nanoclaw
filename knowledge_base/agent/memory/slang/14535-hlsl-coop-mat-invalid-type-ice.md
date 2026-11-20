---
type: chain
title: slang#14535 — HLSL coop matrix: invalid element type / scope ends in an ICE (exit -2)
description: Bot-filed 11-17 08:41Z by the #14433 fixer chain (HLSL sibling of the CUDA fix, open PR #14519). 👀 08:45; triager dispatched on canonical thread.
tags: [hlsl, cooperative-matrix, emit, diagnostics, exit-code, bot-filed, followup-14433]
---

# slang#14535 — HLSL coop matrix invalid type/scope → internal compiler error

**11-17 08:42Z, `issue_opened`.** Live read at routing: OPEN, 0 labels, 0 assignees,
0 comments, author nv-slang-bot[bot]. 👀 posted 08:45Z.

**Ask.** `source/slang/slang-emit-hlsl.cpp` type-path asserts fire after E55208 diagnosis:
`:2088` (`componentType`), `:2092` (`matrixScope`, Device/CrossDevice scopes), `:1601`
(saturating accumulation) — `SLANG_RELEASE_ASSERT` → E99997, exit -2. The expression path
(`:1579-1584`) handles the same failures gracefully. Expected: diagnostic + exit -1.
Reproducer: `CoopMat<BFloat16, MemoryScope.Subgroup, 16, 16, CoopMatMatrixUse::MatrixA>(BFloat16(1.0))`
with `slangc repro.slang -target hlsl -entry probe -stage compute`.

**Provenance.** Filed by the [#14433](14433-cuda-coop-mat-invalid-type-ice.md) fixer chain
(slang-fixer sess-1794885524831-o14qrc) minutes after its [Fix Report] for PR #14519
(08:40Z, head c036fc580, r2 APPROVE_WITH_NITS). Suggested fix mirrors #14519: drop the
asserts, handle nullptr, let error-count fail the compile. #14519 touches only
slang-emit-cuda.cpp, so 14535 should still reproduce on master — triager to verify.

**11-17 08:45Z dispatched** slang-triager on canonical thread
`gh-issue-shader-slang/slang-14535` with post authorization. Fixer-chain start = operator
release decision (today's retro-release waves: #14524 wave-2 07:12Z); triage comment first.

**11-17 08:56Z triaged** (triager report, Main-verified on GitHub: `reproduced` label +
triage cmt 08:56:26Z by nv-slang-bot). Bug/medium/target-emit-HLSL/P2, not a dup —
`HLSLSourceEmitter` derives from `CLikeSourceEmitter`, so open PR #14519 (CUDA files only)
doesn't cover it. All three sites verified on master `3649fb982`: `:2088` (BFloat16 → E55208
then assert), `:2092` (Device scope → E55209 then assert), `:1601` (saturating accumulation →
**no diagnostic at all**, straight assert — fix needs a NEW diag ID, not just assert removal;
worse than filed). Approach A (mirror #14519) recommended; B (target-aware IR validation
pass) = follow-up, shouldn't block. Test → `tests/cooperative-matrix/hlsl-coop-mat-diagnostics.slang`.
Helpers returning nullptr: slang-emit-hlsl-prelude.cpp:305/:363; E55208/E55209 at
slang-diagnostics.lua:6211.

**PARKED on operator release for the fixer start** (fan-out policy). Registered in
supervisor-state.json (`awaiting_human`); dashboard report 09:0xZ. Resume: operator GO →
dispatch slang-fixer on this thread with the triage-comment pointer + note to read PR #14519's
diff first (same assert-removal shape, plus the new :1601 diagnostic).

**Triage memo** (solution brief: "Recommended path" + "Acceptance criteria", 08:56Z):
`memory/slang/raw/triage-14535.md` (preserved from inbox a2a-1794905772883-7dq1x8) — attach
its pointer to the fixer GO when released.

**11-18 18:16Z maintainer design input** — jhelferty-nv (cmt 6987433652, no @mention,
broadcast): "Tess argues that we should have a constraint on the element type parameter of
`CoopMat`." **Handled 18:23Z**: triager posted a research-backed discussion reply
(cmt 6987616637, Main-verified live, 3858 chars) — the constraint ALREADY exists
(`T : ICoopElement`, hlsl.meta.slang:30201; `CoopMat<bool,...>` rejected check-time with
E38029 at the user locus, verified empirically); BFloat16 conforms deliberately (valid
CUDA/PTX m16n8k16 bf16 + SPIR-V), so tightening it breaks valid programs — "valid on CUDA,
invalid on HLSL" needs target-conditional constraints the language lacks. Saturating
accumulation is a `let bool` generic value param (unconstrainable; SPIR-V supports it).
Scope case (Device/CrossDevice invalid on ALL targets) could move front-end via a narrowed
scope enum — maintainer call (source-compat wrinkle). Proposed shape: (1) crash fix stays
emitter-side mirroring #14519; (2) IR-validation-pass follow-up for user-locus diagnostics;
(3) optional scope narrowing. Brief re-adjudicated in the triager's
`memory/issues/triage-14535.md` (§Maintainer design input). OUTPUT_REVIEW applied 2 factual
corrections (process anomaly: critique subprocess posted the comment itself — triager audited
comment/diff/memo, all accurate; learning shared by triager). Residual: one off-by-one line
cite (32133 vs 32134) left in place, immaterial. Fix still PARKED on operator release.
