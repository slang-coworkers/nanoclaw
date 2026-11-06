---
type: chain
title: slang#14238 — `[ForceInline]` helper with integer `/` or `%` in a global `static const` array is no longer folded (G1 regression from #14150)
description: Bot-filed 2026-11-03 from the #14133 chain; G1 regression from merged #14150. Do NOT dispatch its issue_opened. Draft PR #14267 (per-thread rework, Fixes #14238 + #14217) converged R3 APPROVE 11-05; ONE ready-flip ask sent to the operator 00:5xZ, no re-ask.
tags: [cuda, glsl, cpp, force-inline, static-const, regression, integer-division]
---

# slang#14238: G1 regression from #14150 (integer `/`/`%` in a global-scope helper)

⚠️ **The `issue_opened` webhook belongs to the [#14133 chain](14133-cuda-static-const-forceinline-init-file-scope.md),
so do not dispatch it.** slang-triager filed it from that chain's triage session `sess-1793514365085-a6bfnv`.

**Bug.** `[ForceInline] int ceilDiv(int a, int b) { return (a + b - 1) / b; }` in
`static const int arr[2] = { ceilDiv(10, 4), ceilDiv(7, 2) };` (runtime-indexed). Since #14150 (merged 11-03
02:06:54Z, merge `76a45e10c1`), the call stays in the module-scope initializer, and NVRTC, glslang and C++ reject
it. Direct SPIR-V passes. It fails with and without `-g`, with and without `[__readNone]` (also as a struct
member), and for `%` too. A literal divisor passes. A scalar `static const int k = ceilDiv(10,4)` compiles, but
as a per-use call instead of a folded constant. Pre-#14150 `6815ed82d` passes. Cause: `isInlinableAtGlobalScope`
refuses any inst where `mightHaveSideEffects()` is true, and int div/rem with a non-literal divisor is
side-effecting (`slang-ir.cpp:9799-9811`). Our #14150 comment 6592707618 flagged it before the merge.

**Not fixed by #14236** (jvepsalainen-nv's fix for G2/#14235, which only skips debug insts in the same function).
The triager verified #14236 head `4c34875db` 11-03.

## Current state (11-05 00:56Z)

| field | value |
|---|---|
| PR | draft **#14267**, branch `fix/issue-14238`, head `485637d9c` (verified), 9 files +519/−9, `pr: non-breaking`; Fixes #14238 + #14217 |
| review | R3 APPROVE, 0 bugs / 0 gaps (fixer-reported); 37/37 new lanes |
| CI | run 41942522276 waits on the approval gates |
| ready-flip | **ONE direct ask sent to the operator 11-05 00:5xZ** (regression exception; v2026.21 shipped the regression): "flip 14267" / "hold 14267", recommended flip now. **No re-ask.** No answer → weekly ready-flip list. Fixer holds `gh pr ready` until I relay an answer. |
| issue comment | 5-bullet 6613001265; delta 6640934112 (edited in place for r2) |
| sessions | fixer `sess-1793732830219-r1jbdf` (pr-mapping owner); triager: fresh session on `gh-issue-shader-slang/slang-14238` (opened 11-04 19:1xZ; the old `t-700e05` parent `sess-1793667544858-o8dnsv` is closed); Main `sess-1793690897967-0o6crb` |

## Decisions that still bind

- **Maintainer direction (jhelferty-nv, 11-04 19:05Z, cmt 6639517817), verbatim:** "Based on discussion, the bug here is
  that the code generated doesn't compile. This should be implemented as a dynamic calculation. (There was no promise in
  the language beforehand that this would be resolved to a compile-time constant, should be a per-thread dynamic
  calculation.)" So the r1 constant-folding commits (1) `06d680192` and (3) `883bedf6a` were reverted.
- **r2 design:** a worklist in `inlineGlobalValuesAndRemoveIfUnused` removes inlined operands once they have no uses;
  the per-thread form comes from #14204's `IRCall` rule in `inlineGlobalConstantsForLegalization` (#14204 merged 11-04
  02:32:33Z, `139f09f597`, verified). `idiv(10,0)` behaves as on master. Merge master, never force-push.
- **Commit 2 (`b5ff14441`, `-g` debug-inst clone skip) lives in its own chain:**
  [[slang/14321-g-debug-clone-module-scope-uniform-ice.md]] — not a regression, not a dup of #9078.
- **Q1** (E31226 vs. struct `static const` member skipping it, `isGlobalDecl` slang-check-decl.cpp:3833) is posted
  once, on #14321 (cmt 6646031120); neither PR blocks on it. **Q2** (`docs/user-guide/02-conventional-features.md:599`
  "compile-time constant") is one line in #14267's description, held until Q1 is answered.
- Relay maintainer comments to the fixer **through the triager**, never direct; a question for the maintainer comes to me first.

## Owned side-filings — do not dispatch their `issue_opened`

#14278 ([[slang/14278-wgsl-static-const-spec-constant-hang.md]]), #14279
([[slang/14279-spirv-constantcomposite-spec-constant-operands.md]]), #14280
([[slang/14280-g-noinline-scalar-static-const-dynamic-init.md]], probably fixed on master by #14204), #14321, and
**#14330** (CUDA vector arithmetic in a global const → ptx dynamic init; filed-only, not a regression, related to #13444).
#14217 is fixed by #14267. #14238's own `issue_opened` belongs to [[slang/14133-cuda-static-const-forceinline-init-file-scope.md]].

Dated history (filing, operator ask, Approach A → 3-commit design, r1/r2/R3 rounds, side finds, rework):
[[slang/14238-history-triage-to-ready.md]]. New dated entries go to the history file, not here.
