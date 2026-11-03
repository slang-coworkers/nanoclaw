---
type: chain
title: slang#14058 — Metal discarded atomic results → -Wunused-variable temporaries
description: "Human bug (albertrodriguezclo, CONTRIBUTOR, cloth-sim batch) 10-29 21:51Z. Metal emit binds a discarded atomic_fetch_* result to an unread temp. Triaged P2 10-29 (emit-side root cause, approach A); fixed locally by fixer uy6784 (unpushed); conflicts with draft PR #14044 in a few lines. Draft PR #14209 @315e95a52 opened 11-02 22:14Z (atomics + discarded calls); R1 APPROVE_WITH_NITS applied (head 8d9dd07cc); PARKED on operator un-draft; re-chase 11-05 16:00Z."
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

**11-02 10:25Z reporter comment 6574800687 (no bot mention).** The warning is wider than atomics. The reporter
compiled master `6815ed82d` tests with Apple's compiler: any discarded **call** result gets the same temp. That covers
user functions, `q.next()`, `frexp` with only the out param used, `writeSingle_*`, and even an explicit `(void)` cast.
15 of 41 warning files are non-atomic (32 warnings, against 347 for atomics). The reporter places calls in the shared
C-like emitter ("emit a call whose result has no uses as an expression statement") and atomics in Metal's
`emitAtomicOp`. This is the user-call case the triager held back as a separate-issue candidate on 10-29.
- 10:28Z: forwarded verbatim to the triager (pinned g1df5o, in_reply_to my webhook row 30; ✅ landed as seq 30,
  session running). The scope decision (widen to the C-like call path or split it off) is the triager's and the fixer's.
  They must relay it to the fixer before its 22:00Z push and answer it in the 22:45Z post. Still unpushed (404) at 10:28Z.

- 10:31Z triager interim (msg 40, its finding): reproduced on master 6815ed82d. All six targets bind the discarded `setA`, `(void)setA` and `frexp` results: Metal, HLSL, GLSL, CUDA, C++ and WGSL. It is checking a fix limited to `IRCall` in `_emitInst`'s default branch (not approach C). The scope decision and fixer relay are promised before 22:00Z.

**10:48Z [Report] (triager msg 42): WIDENED to discarded non-void call results.** The gate is only in `_emitInst`'s
default branch, for an IRCall with no non-debug use (`hasNonDebugUse`). `emitInstResultDecl` is untouched, which honors
the 10-29 rejection of approach C. User callees and ordinary-name intrinsics emit a bare `f(...);`. Template-expanded
intrinsics emit `(void)(…);` on Metal/C++/CUDA (this covers `frexp`) and keep the binding on HLSL/GLSL. `(void)e` lowers
to a dropped CastToVoid, so it is the same 0-use IRCall. **WGSL is unchanged**: a bare call_phrase is the only valid
form and `@must_use` builtins would hard-error; `_ = …;` is optional, left to the fixer. The audit found no FileCheck
anchors on unused call temps. Fallback: if the call path grows past a contained change, the atomics PR ships as "Part
of #14058" and calls follow in a second PR. Out of scope: non-Call 0-use side-effecting insts (Div/IRem, ImageLoad,
StructuredBufferConsume, wave ops). Rescope memo: triager `memory/issues/triage-14058-rescope.md`.
- ✅ Main-verified 10:49Z: fixer uy6784 received the rescope handoff (its seq 16 + memo seq 18, 10:47Z) and is
  running. The issue still has only the reporter's comment and no labels.

**13:28Z [Report] (triager msg 48, relaying fixer msg 38; fixer-reported, not re-run).** WIDENED FIX DONE LOCALLY on
`fix/issue-14058`, 5 commits on 6815ed82d:
- 16b1ab9b3 atomics test
- 98fb8e210 `hasNonDebugUse`
- 701fb4730 Metal atomics
- db2a43f84 call test
- 993ef6c78 `tryEmitDiscardedCallStmt`, called only from `_emitInst`'s default branch; `emitInstResultDecl` is unchanged

Results:
- `tests/metal/unused-call-result.slang` passes 15/15. The metallib `-Werror` lanes and the Metal runtime lane need macOS CI.
- gh-471, frexp, ray-tracing-inline and nodiscard-void-cast pass. The full suite gives 11383/11386; the 3 `fp8-cuda` failures also fail on baseline.
- 5378 files were compiled for 6 targets, with and without `-g`. WGSL output is byte-identical; every other diff only drops `T _Sn = ` or adds `(void)`.
- Revert drill: the `-g` runs need `hasNonDebugUse`.

The triager accepted one deviation: every target-intrinsic call, not just template expansions, gets `(void)` on
Metal/C/C++/CUDA and keeps its temp on HLSL/GLSL. A bare pure intrinsic draws DXC's default-on -Wunused-value, which
slangc's `-no-warnings` hides; the fixer confirmed it with libdxcompiler.
- ✅ Main-verified 13:29Z: still unpushed (404); the issue has 1 comment (the reporter's) and no labels.

**11-02 22:29Z [Report] (triager msg 50). DRAFT PR #14209** `fix/issue-14058` @ 315e95a52 (Main-verified 22:35Z):
- **PR:** author app/nv-slang-bot, created 22:14:33Z. The body says `Fixes #14058` but does **not** mention #14044. Label `pr: non-breaking`.
- **Draft CI:** 3 pass, 53 skipping (the draft gate).
- **Fixer-reported:** both new tests pass 22/22 on the L40S.
- **Issue #14058** (Main-verified): label `reproduced`, Type=Bug. Fixer status comment 6590012034 (22:24Z). Triager
  delta reply 6590092293 (22:28Z), answering 6574800687 with the per-target design. t-944bbf cancelled (done live).
- **Review:** slang-reviewer `sess-1793658353934-9r1jbl` started R1 at 315e95a (no GitHub post).
- ⚠️ **The PR mapping points at the fixer's one-shot task session** `sess-1793316915418-fejlik`
  (`system:tasks:slang-14058-resume-0060`, now driving the PR), not its chain session `uy6784` (stopped). This is
  first-claim-wins, the same as #14037/#14194. No remap requested (approval-gated; webhooks reach the driving session).
- 22:36Z: asked the triager to have the fixer add a one-line #14044 overlap note to the PR body at its next body
  update. This was my suggestion, not a maintainer ask.

- 22:38Z: the triager relayed the overlap note to the fixer (msg 67, PR-driving session edge). It goes on the Risk line at the next PR-body update, with no push just for it.

**11-03 00:42Z [Triage Resolution] (triager msg 60; fixer [Fix Report] msg 62).** FIXED in draft PR #14209.
Main-verified 00:45Z:
- **PR:** head 8d9dd07cc. The Risk line reads "Conflicts with #14044 and #14170 in `slang-emit-metal.cpp`; the second to
  merge resolves a few lines." Assignee and requested reviewer: jkwak-work (repo automation).
- **CI:** run 41552378383 is `waiting` at the priority-yield gate; run 41554461250 succeeded.
- **Issue:** the fixer's status comment 6590012034 was refreshed at 00:39:55Z; the triager did not re-post.

Review and tests:
- **Review:** slang-reviewer APPROVE_WITH_NITS, 0 bugs. G1, G2 and N1–N6 are applied, and codex approves. G3 is open:
  the metallib `-Xmetal -Werror` lanes have never run.
- **Fixer-reported tests:** new tests 23/23 (6 macOS lanes ignored); regression subset 1858/1859 (the `texture-simpler`
  cuda failure lost its test server and passes alone); full suite 0 regressions.
- **PARKED** on the operator's un-draft decision. A human must click Ready, because the fixer spine forbids
  `gh pr ready`. A maintainer must also clear the CI gate and review. 1st ask sent on orchestrator-dashboard
  thread gh-issue-shader-slang/slang-14058 at 00:46Z. **Timer:** one-shot `rechase-slang-14058-r1-1d3f`, 11-05 16:00Z
  (cap 3).

**Side find S1** (reviewer, pre-existing, nothing posted). Under `-g`, a value whose only use is a `DebugValue`
survives DCE, and C-like emitters never print it, so it becomes an unread temp. The reviewer counted 639 such temps in
330 Metal `-g` test files. Repro: `int unread = setA(int(tid.x)) + 1;` with `-target metal -g`. Cause:
`stripDebugInfo` runs only at `-g0` (slang-emit.cpp:1099), although the comment at 1097 says "or the target cannot
express debug info". Per [the filing policy](../orchestrator/filing-verified-issues-policy.md), I told the triager
on 11-03 to **file it** once it reproduces on current master and is deduped. It should be low severity and filed-only,
with no fixer chain, and the number reported up.

- 00:45Z S1 interim (triager msg 70): the dedupe search is clean. The closest issues are SPIR-V-only debug #13841/#13842 and the closed #11682. The triager is rebuilding on master 7f506f4c9 to reproduce before filing.

- **00:48Z S1 FILED as #14216** (triager msg 72). Title: "With -g, values used only by debug info are emitted as
  unread locals on C-like source targets". Main-verified: author app/nv-slang-bot, created 00:47:47Z, label
  `reproduced`, Type=Bug, no assignee, no @-mentions, no Fixes link. Filed-only, low priority, **no fixer chain**.
  Master-only repro (7f506f4c9): `uint t = tid.x * 7u; uint unread = t + t;` with `-g` emits an unread `t_0` on all
  six C-like targets. ⚠️ **#14216's `issue_opened` webhook belongs to this chain, so do not dispatch it.** A human
  comment on it goes to the triager as a live inbound.

**Open / resume on:** the operator's un-draft answer; jkwak-work's review;
the re-chase on 11-05 16:00Z. #14044/#14170 overlap: the second to merge resolves it.
