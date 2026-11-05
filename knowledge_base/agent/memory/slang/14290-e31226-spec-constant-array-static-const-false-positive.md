---
type: chain
title: slang#14290 — E31226 false positive for a `static const` array initialized from a `[vk::constant_id]` spec constant
description: Bot-filed 11-04 03:19Z, out-of-scope find of the #14278 / PR #14285 chain. Regression since v2026.9 (#10925). Do NOT dispatch its issue_opened webhook. Held filed-only until #14279's draft PR opens, then the triager hands it off.
tags: [front-end, diagnostics, specialization-constant, static-const, regression, side-finding]
---

# slang#14290: E31226 false positive for spec constants in a `static const` array

⚠️ **Its `issue_opened` webhook belongs to the [#14278 chain](14278-wgsl-static-const-spec-constant-hang.md),
so do not dispatch it.** The Main session minted for it (`sess-1793762399875-ad44bm`) must send nothing.

The #14285 fixer raised it; slang-triager (task session `sess-1793667544858-o8dnsv`) reproduced and filed it on 11-04 03:19Z.
Labels: Bug, `reproduced`, `regression`. No @-mentions. `static const int a[2] = { N, 3 }` (also `{N+0,3}` and `{N,N}`)
with a `[vk::constant_id]` N is rejected with "static const global initializer must be a compile-time constant" on spirv,
glsl and hlsl. master `f1cd35ff8` rejects it; v2026.5.2 and v2026.7 accept it. The diagnostic came from #10925 (first
released in v2026.9). Cause, from a code read: `_initExprIsRuntimeValue` (slang-check-decl.cpp:3698) exempts only
`static const` globals, so a spec-constant `const` counts as mutable. A scalar escapes because it constant-folds.
Once #14290 is fixed, SPIR-V hits [#14279](14279-spirv-constantcomposite-spec-constant-operands.md) for the same shape.
Triager suggests P2, after #14279.

**11-04 03:2xZ, Main:** held filed-only. #14279 starts now (4 fixer sessions are running). When #14279's draft PR opens,
the triager hands #14290 to slang-fixer on `gh-issue-shader-slang/slang-14290` without asking me again. Not filed: the
`shouldInlineInstImpl` ancestor-lookup dead condition (no reachable input; I declined a cleanup Enhancement) and
`replaceOperand` re-keying (no repro).
**11-04 04:2xZ: handed to slang-fixer** (triager msg 95, thread `gh-issue-shader-slang/slang-14290`) once #14293 opened,
as pre-authorized. The issue comment 6621824729 is now the triage 5-bullet: regression / P2 / frontend. Plan: a one-line
exemption in `_initExprIsRuntimeValue` (slang-check-decl.cpp ~:3698) using `isSpecializationConstant()` (:2649). A plain
non-static global `const` is already E31224, so the exemption cannot let real uniforms through. The 5 existing
static-const-global-*.slang E31226 tests must still pass. Lanes: glsl/hlsl filecheck only; SPIR-V validation depends on
#14293, and glslang is not run on the array form because of #14291. Ready-flip: triager → me → one operator ask (regression).
**11-04 05:43Z: draft PR #14300 OPEN**, "Do not report E31226 for specialization constants in static const initializers"
(head `6e93deddb`, `pr: non-breaking`, `Fixes #14290`). Issue comment 6621824729 now says "fix in draft PR #14300, held".
Peer review next. Ready-flip: one direct operator ask (regression).
**11-04 06:33Z:** R1 side find filed as #14301 (filed-only, P3). The fix also covers float scalars and vectors (the fixer
corrected the brief: only integer scalars fold). R1 commit c685ff1 limits the exemption to
`isGlobalShaderParameter && isSpecializationConstant`.
**11-04 08:06Z: ready-flip question** (triager row 476; fixer [Fix Report] msg 118). #14300 head `7f85917ab`, 6 commits,
5 files +152/−1, CI 41792324785 dispatched. The fix is wider than the brief: floats, vectors, `min()`, non-`const` spec
constants and GLSL mode are covered too. Reviewer APPROVE_WITH_NITS after 2 rounds, with a merge condition: #14293 lands
first, then the SPIR-V/Vulkan lane patch is applied (4/4 on #14293 + #14300; the patch is in the fixer's workspace).
**08:1xZ, Main decided (b): hold it as a draft, with no operator ask.** If #14300 lands before #14293, programs that error
today compile to invalid SPIR-V and slangc reports success. Fixer told: replace the "Open question" with "Depends on
#14293"; save the lane patch outside the worktree; when #14293 merges, merge master (no rebase), apply the lanes, run them
on the L40S, and send the ready-flip question again. Then I make one direct operator ask. **Blocked on #14293**, which is
itself waiting on the operator's 05:2xZ ready-flip ask.
**11-04 08:09Z: parked as asked.** #14300's description says "Depends on #14293: merge after it…". The lane patch is at
`/workspace/agent/patches/fix-14290-post-14293.patch` **in the fixer container** (the slang-fixer group folder;
`git apply --check` passes at `7f85917`). The fixer's notes are in `memory/fix-14290.md`. All PR work is pushed. The issue
comment says "held as a draft until #14293 merges".
