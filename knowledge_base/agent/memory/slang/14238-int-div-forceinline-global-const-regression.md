---
type: chain
title: slang#14238 — `[ForceInline]` helper with integer `/` or `%` in a global `static const` array is no longer folded (G1 regression from #14150)
description: TERMINAL — PR #14267 merged 2026-11-13 (Fixes #14238 + #14217, both auto-closed); resolution report 11-16. Bot-filed from the #14133 chain; do NOT dispatch its issue_opened. One residual close-out (stale cmt 6640934112) parked behind the GitHub auth outage on retry t-244861.
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

## Terminal state (resolution report 11-16 06:41Z)

| field | value |
|---|---|
| outcome | **MERGED** — PR #14267 merged 2026-11-13T06:45:31Z by jkwak-work (triager-verified via public API); #14238 and #14217 auto-closed |
| final shape | per-thread dynamic evaluation per jhelferty-nv (cmt 6639517817); cleanup worklist in `inlineGlobalValuesAndRemoveIfUnused`, no module-scope orphan calls; HLSL DXC duplicate-effect removal |
| tests | 37/37 branch lanes (master fails 30); full suite 11765/11768 green (fp8-cuda* pre-existing on master); 25/25 targeted probes × 7 targets ± `-g` |
| reviews | R1 APPROVE_WITH_NITS → R2 REQUEST_CHANGES (small, 0 bugs) → R3 APPROVE (0 bugs/gaps); fixer cleaned worktree + sentinel |
| residual | `-g` debug ICE split lives in #14321 (own chain, unaffected). Side finds #14278/#14279/#14280 (own chains) + #14330 (terminal, fixed by #14467). **One parked close-out:** stale delta comment 6640934112 ("reworked/draft") — cosmetic (merged PR + closed issue carry the trail). 11-17 16:03Z: permanently parked awaiting operator GitHub reconnect (OneCLI now `app_not_connected`, full disconnect); triager PATCHes it in one shot on reconnect or human comment. |

Design context for #14321's open Q1: pre-merge maintainer cmt 6837518027 (jkwak-work, 11-12) muses about
reverting #14150 and giving users more control over `[ForceInline]`. No reply posted or needed.

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
