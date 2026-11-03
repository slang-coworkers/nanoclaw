---
type: chain
title: slang#14179 — WGSL vector negation `vecN<T>(0) - x` turns -0.0 into +0.0
description: "albertrodriguezclo, human-filed WGSL emit bug (signed-zero parity). Same kIROp_Neg case as parked draft #13572. Dispatched to slang-triager 2026-11-02 under R6 hold."
---

# slang#14179

**2026-11-02 12:21Z, webhook `issue_opened`.** Live read before dispatch: OPEN, 0 comments, no labels,
no assignee, human-filed by albertrodriguezclo, `updated_at` = `created_at`, live body length 2807.
Only session on `gh-issue-shader-slang/slang-14179` was this Main webhook session. Memory grep on
`14179` had only false hits (session-id substrings).

Claim: `slang-emit-wgsl.cpp` `kIROp_Neg` lowers every vector negation to `(vecN<T>(0) - x)`, which
gives +0 for a +0 component where Metal/CUDA/SPIR-V give -0. Suggested fix: native unary `-` for
signed-element vectors (f32/f16/i32), keep `T(0) - x` only for unsigned vectors.

**Overlap with [#13571](13571-wgsl-matrix-negation.md) / draft PR #13572** (PARKED 10-20, head
`46ac7f64a7`, fixer `sess-1791749819525-d9mn82`). #13572 rewrites the same case: matrices become
`(T(-1) * x)` (keeps -0), and its new vector-branch comment *acknowledges* "for a float zero element
the subtraction yields +0, not -0" but leaves it. Master's comment claims the subtraction "matches
'-x' for the signed cases too", which this issue refutes. Fold-in vs separate PR is the triager's
call to recommend.

**R6 hold:** no labels, no crash word → no bot comment, PR, or commit naming the issue before
**2026-11-06T12:21:02Z**.

Dispatched to `slang-triager` on `gh-issue-shader-slang/slang-14179` 2026-11-02.

**2026-11-02 12:58Z, triaged** (slang-triager, memo `memory/issues/` in its group; nothing posted, R6).
Regression of the emitted form / low / P2 / target-emit (WGSL). Reproduced on master 6815ed82d. #7936
(v2025.14) introduced `T(0) - x` for vectors; v2025.1 emitted `- x`. naga and Tint reject `-x` only for
unsigned vectors. The WGSL spec lets implementations ignore the sign of zero, so this is cross-target
parity, not conformance. On NVIDIA Vulkan both forms give -0 (the driver folds `0 - x`). Approach A (+4/−1):
`T(0) - x` only for matrices and unsigned vectors; signed vectors fall through to the c-like `"- "` path.
The triager's one-shot **t-c47654** at 11-06 12:30Z posts the triage comment and labels.

**13:00Z, decision (mine): (a) fold into #13572.** Reasons: same case and test file; #13572 needs a master
merge anyway (CONFLICTING in legalize-matrix-types since #14022/#13715/#14098); 0 human reviews
lost; jkwak-work's own #7936 suggestion (`op0 * type(-1)`) preserved -0 for vectors. Woke the #13572 owner
`sess-1791749819525-d9mn82` (pin + in_reply_to=2, landed seq 30/32): Part 1 = merge master now (no
rebase); Part 2 = fold in approach A, kept local until the hold ends, then push + `Fixes #14179` with the
fixer's own one-shot at 11-06 12:25Z. #13571 was unparked from the register.
