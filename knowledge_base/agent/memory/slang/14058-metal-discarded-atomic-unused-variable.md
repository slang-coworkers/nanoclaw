---
type: chain
title: slang#14058 — Metal discarded atomic results → -Wunused-variable temporaries
description: "Human bug (albertrodriguezclo, CONTRIBUTOR, cloth-sim batch) 10-29 21:51Z. Metal emit binds a discarded atomic_fetch_* result to an unread temp. Triaged P2 10-29 (emit-side root cause, approach A); fixed locally by fixer uy6784 (unpushed); conflicts with draft PR #14044 in a few lines. R6 hold to 11-02 21:51Z."
---

# slang#14058: discarded atomic results produce `-Wunused-variable` in Metal output

**Filed** 2026-10-29T21:51:33Z by albertrodriguezclo (CONTRIBUTOR, same cloth-sim port batch as
#14027/#14029/#14031–#14037). No labels, no assignee, 0 comments at dispatch.

**Ask.** `InterlockedAdd(p[i], 1u)` (no `original_value`) and `Atomic<T>::add(...)` with the result discarded
emit `uint _S2 = atomic_fetch_add_explicit(...)` on Metal; `xcrun metal` warns once per call site, which breaks
`-Werror` builds. Expected: an expression statement, `[[maybe_unused]]`, or a `(void)` cast.

**Routing (10-29 ~21:55Z).** `grep 14058 memory/slang/` had no hits, and no session on
`gh-issue-shader-slang/slang-14058` except my own Main webhook session `sess-1793310696129-4xjgxm`.
Dispatched to slang-triager on that thread (msg 11; triager session `sess-1793310892825-g1df5o`, verified running). **R6:** no labels, no crash word → no bot comment before
2026-11-02T21:51:33Z.

**Adjacent work flagged to the triager (not owned by this chain):**
- [#14031](../imported/project_14031_metal_64bit_atomics_atomic_ulong.md) / bot draft PR #14044 rewrites Metal
  atomic emit for 64-bit; it may touch the same emit path, so a fix here must coordinate.
- [#13771 record](../imported/project_13771_metal_rwtexture_fence.md) already saw this exact warning on the atomic result.

**21:55Z triager interim (msg 14, its finding, not yet verified by me).** Reproduced on Metal (local build, master 977df1246 era). GLSL and CUDA also bind the unread temp, so this is not Metal-only. Root-cause trace in emit is in progress.

**22:13Z [Triage] (msg 16, memo msg 18 → `/workspace/inbox/a2a-1793311988989-tbb812/triage-14058.md`).**
bug / low / P2 / target-emit (Metal), no duplicate. Triager's root cause: emit, not lowering. Both `atomicAdd` results
have 0 uses in the IR that reaches emit. `shouldFoldInstIntoUseSites` correctly does not fold them. The Metal
`tryEmitInstStmtImpl` atomic lambda (slang-emit-metal.cpp:424-453) calls `emitInstResultDecl` unconditionally;
texture atomics also append `.x`, which would give -Wunused-value if only the decl were dropped. HLSL/GLSL/CUDA bind
the temp too (the reporter's "as for other targets" is wrong), but only Metal's default warnings flag it.
Recommended **A**: the Metal atomic paths skip the decl and `.x` when the result has no non-debug use (new
`hasNonDebugUse` in slang-ir-util.h). Rejected: C (a generic skip in `emitInstResultDecl` breaks WGSL and
SwizzleSet/UpdateElement) and D (`[[maybe_unused]]`/`(void)`, which masks the symptom).
- ✅ Main-verified 22:14Z: slang-fixer session `sess-1793311978024-uy6784` is running on the canonical thread. Triager
  re-check session `system:tasks:t-944bbf` exists (`sess-1793311883377-amdgh1`). The task fires 11-02 22:00Z: issue
  5-bullet, `reproduced` label, Type=Bug.
- ✅ Main-verified: **#14044 collision is real.** PR #14044 (draft, head f800a8e21) adds
  `emitAtomicCall(imageFunc, bufferFunc, bool returnsValue)` with a skip-decl path, so the #14058 fix reduces to
  `returnsValue = hasNonDebugUse(inst)`. The triager told the fixer to rebase on #14044 or copy its shape; whichever
  PR merges second adapts. Both fixer sessions are in slang-fixer (#14044 owner `uqb9b4`, #14058 owner `uy6784`).
- The fixer holds the draft PR until after R6 (the triager's call: a PR cross-links the issue).
- Adjacent, not filed: a discarded non-void **user** call (`uint _S3 = bump_0(...)`) gets the same unused temp on every
  C-like target. It is a candidate for a separate issue; no bot filing without a maintainer ask.

**23:36Z [Report] (triager msg 24, relaying fixer msg 24; fixer-reported, worktree not visible to the triager).**
FIXED LOCALLY on `fix/issue-14058`, 3 commits on 977df1246 (failing test → `hasNonDebugUse` → Metal fix). When
the result has no non-debug use, Metal RMW/Load/Inc/Dec/CAS emit bare calls (no temp, no texture `.x`, no CAS
decl/copy). New `tests/metal/atomic-unused-result.slang` passes 7/7 (two metallib `-Werror` rows need macOS CI). The
atomic+Metal corpus gives 477/477 and the full suite 11307/11310 (3 `fp8-cuda` failures, which also fail on master). The
137 atomic tests emit identically on HLSL/GLSL/CUDA/WGSL. Revert drill: `hasUses()` in place of `hasNonDebugUse` fails
only the `-g` runs. The fixer did **not** copy #14044's `emitAtomicCall` shape; whichever PR lands second resolves a
conflict of a few lines.
- ✅ Main-verified 23:37Z: the branch is not pushed (404), the issue has 0 comments and 0 labels (R6 respected), and the
  fixer resume task session `system:tasks:slang-14058-resume-0060` exists.

**Open / resume on:** fixer resume `slang-14058-resume-0060` 11-02 22:00Z (push, draft PR, review), then triager
t-944bbf, moved to 11-02 22:45Z (issue 5-bullet citing the PR, `reproduced`, Type=Bug), then the fixer's final
[Fix Report] and the [Triage Resolution]. The PR must state its #14044 overlap. Operator: #14044 draft-vs-ready is still open.
