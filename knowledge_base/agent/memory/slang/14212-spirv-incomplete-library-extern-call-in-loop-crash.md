---
type: chain
title: slang#14212 — slangc segfaults with `-incomplete-library -target spirv` when an entry point calls an `extern` function inside a loop
description: Human-filed (tomaszbk) bug 2026-11-02 23:39:56Z. Routed to slang-triager on gh-issue-shader-slang/slang-14212 with no hold (R6 retired). Related to #6607 (export side, E57004).
tags: [spirv, linkage, incomplete-library, extern, crash]
---

# slang#14212 — `extern` call in a loop crashes `-incomplete-library -target spirv`

**Report.** `extern uint f(uint);` called inside a `for` loop in a compute entry point, compiled with
`slangc -target spirv -incomplete-library`, segfaults with no diagnostic and no output (2026.19 and
2026.20, Windows). The same call outside a loop compiles. Without `-incomplete-library` the compiler
correctly reports E45001. The expected result is SPIR-V with `OpCapability Linkage` and `f` as a
`LinkageAttributes ... Import`. The export side of the link is #6607 (E57004).

**Routing (11-02 23:4xZ).** Live check: open, 0 comments, no labels. `grep 14212` over memory: no
hits. Only the Main webhook session `sess-1793662799080-j57oec` was on the canonical thread; there was
no triager session. Dispatched slang-triager on `gh-issue-shader-slang/slang-14212` with no hold.

**Triager progress (11-02 23:43Z, msg 8; the triager's finding, receipts not yet seen).** Reproduced
on Linux with a recent Release build: exit 139. The non-loop variant compiles, and dropping
`-incomplete-library` gives E45001. Next it rebuilds at current master and finds the crashing pass.

**Triager progress (11-02 23:44Z, msg 10; the triager's finding).** The crash happens after the last IR
pass (`checkUnsupportedInst`), so it is in SPIR-V emission (`slang-emit-spirv.cpp`). Next it finds the
null dereference and checks for duplicates. Note for routing: the CLAUDE.md methodology says emit is
usually not the layer to fix, so the triage report should name the upstream producer.

**Triager progress (11-02 23:45Z, msg 12; the triager's finding, receipts not yet seen).** The crash is
in the SPIRV-Tools optimizer that Slang runs after emit, not in Slang IR or emit. `DeadBranchElimPass::FixBlockOrder`
calls `Function::ReorderBasicBlocksInStructuredOrder` on the body-less imported `f`, which reads `blocks_[0]`
from an empty vector (`external/spirv-tools/source/opt/function.cpp:279`). The loop matters because
`FixBlockOrder` runs only when dead-branch elimination changed something. Next: upstream SPIRV-Tools,
workarounds, duplicates.
⚠️ **If the fix is upstream in KhronosGroup/SPIRV-Tools, filing there is an external-repo filing and needs
the operator's go-ahead** ([policy](../orchestrator/filing-verified-issues-policy.md)). Reference it as plain
text in bot posts ([no cross-repo links](../feedback_no_gratuitous_cross_repo_links.md)).

**Triage (11-02 23:53–23:54Z, msgs 16+24; memo [raw/slang-14212-triage-memo.md](raw/slang-14212-triage-memo.md)).** Bug/high/P2,
not a duplicate. I verified the GitHub comment (issuecomment-6591527100, nv-slang-bot 23:53:20Z) and the
`reproduced` label. The loop is not the root trigger: the no-loop file also crashes at -O2/-O3, and only
-O0 is clean. The two crash sites are SPIRV-Tools DBE `FixBlockOrder` (-O1) and LSSE (-O2+). Slang also
emits no Linkage/Import for user externs, which is the same gap #6607 has on the export side. A side gap:
`spirv-asm` lacks a `doesTargetAllowUnresolvedFuncSymbol` case.
**Fixer:** the triager handed off directly (triager→fixer wiring). The slang-fixer session is `sess-1793663556469-czjkej`,
claimed 23:53Z, worktree `wt-slang-14212` @ 96a728c85, plan B+C. I did not dispatch it.
**OPEN decision (operator, asked on the dashboard 11-02 23:5xZ, thread 14212, with the memo attached): file the upstream
SPIRV-Tools issue?** The draft is in the memo. Nothing is filed. The Slang fix does not wait on it.

**Draft PR #14220 (11-03 01:22Z, triager msg 26; I verified it on GitHub).** Branch `fix/issue-14212`, head d958b751e, draft, `pr: non-breaking`,
author nv-slang-bot. Checks: 4 pass, 53 skipping (draft). The PR emits Import linkage for user externs, skips spirv-opt only for
unlinked modules that still import symbols, and adds the spirv-asm `-incomplete-library` case. Test results are the fixer's claim
from the PR body: a new regression test and 3,757 related tests pass. The triager edited its issue comment in place. Next: the
fixer's [Fix Report], then the triager's [Triage Resolution]. The upstream SPIRV-Tools filing is still the operator's OPEN decision
(no reply on the dashboard as of 01:2xZ).
**Fixer note (01:26Z, msg 30; the fixer's claims).** CI run 41559216126. C covers `[import]` declarations only. c/d exit 0 at -O0..-O3
and pass spirv-val. 3757/3757 pass. Precompiled linked outputs are byte-identical to master. The fixer sent a review request
to slang-reviewer, and its [Fix Report] follows the verdict. Fixer issue status comment: issuecomment-6592949557.

**R1 review (11-03 02:35Z, reviewer msg 32; [raw/slang-14220-r1-combined-review.md](raw/slang-14220-r1-combined-review.md)).**
APPROVE_WITH_NITS: 0 bugs, 2 gaps, 1 test gap, diff_hash 55f877fc4f8f…. Full suite at head 11206/11209; the 3 `fp8-cuda*` failures
also fail on base. The findings:
- G1: the skip also covers precompiled-import chains. Base exits 139 there at -O1 even without `-incomplete-library`, so keep the
  skip, rename it `hasUnresolvedImports`, and add a chain test with explicit -O1.
- G2: explicit `-Xspirv-opt` passes are silently dropped. Skip only the -O preset.
- T1: tighten the test.
The fixer got the review and `pr14220-r1-remedy.patch` directly (fixer seq 16/18). Applying the patch verbatim needs no new round.
**Side finds S1–S3** (all pre-existing: autodiff extern segfault; silent exit 0 on an internal spirv-link failure; Function→PSB
pointer to an extern). I relayed them at 02:3xZ to the triager session `oxp8ul` (pin + in_reply_to=2) to reproduce, dedup and
file as filed-only.
- 02:36Z (triager msg 52): the relay landed in `oxp8ul`. **S1 reproduces** on master 7f506f4c9: it segfaults on hlsl/cuda/spirv/metal/wgsl/cpp,
  and glsl gives E45001. The stack shows a null first block in `ForwardDiffTranslationContext::insertTempVarForMutableParams`
  (slang-ir-autodiff-fwd.cpp:2333). Dedup, S2 and S3 are pending.
- 02:38Z (triager msg 56): **S1 has no duplicate**. #14200 and #14213 are a different defect (body-less `__extern_cpp` entry points).
  **S2 reproduces on master** at -O0 and -O1 without #14220, through a different trigger: a precompiled module whose SPIR-V uses
  PhysicalStorageBuffer64 pointers, imported by a shader that does not. The internal spirv-link fails with "Conflicting addressing
  models", and slangc exits 0 with no output and no diagnostic. The triager is tracing where the failure is swallowed, then S3.
- **02:42Z (triager msg 58): side finds FILED (I checked all 3 on GitHub: open, nv-slang-bot, `reproduced`). All are filed-only, and the
  #14212 chain owns them. ⇒ Their `issue_opened` webhooks need NO dispatch.**
  - **#14223** (S1): `fwd_diff` of a body-less `[Differentiable] extern` segfaults under `-incomplete-library`. The crash is at `insertTempVarForMutableParams`, slang-ir-autodiff-fwd.cpp:2333.
  - **#14224** (S2): slangc exits 0 with no output and no diagnostic when its internal spirv-link fails. The trigger is a precompiled PhysicalStorageBuffer64 module imported into a pointer-free shader ("Conflicting addressing models"). Its `issue_opened` webhook reached Main on 11-03; not dispatched, per this record.
  - **#14225** (S3): `&local` passed to an extern pointer param gives invalid SPIR-V. `specializeAddressSpace` skips body-less callees (slang-ir-specialize-address-space.cpp:321-323).
- 02:43Z: the #14223 `issue_opened` webhook reached a Main webhook session. I matched it to this record and did not dispatch it.
- 02:4xZ: I told the triager to dedup the possible 4th bug and file it filed-only: the addressing-model link conflict itself, which is the S2 trigger. **Done: the dashboard report of
  all the filings went out at 02:4xZ (thread 14212, 4-row table plus the open SPIRV-Tools question).**
- 02:43Z: the #14225 `issue_opened` webhook reached a Main session. Live: open, 0 comments, `reproduced` only. Not dispatched (filed-only, owned here).
  - **#14226** (4th, the S2 trigger; triager msg 60): precompiled-module linking fails with "Conflicting addressing models" when exactly one side uses pointers.
    It fails in both directions. The cause is that the addressing model is chosen per module: each starts `Logical` (slang-emit-spirv.cpp:509) and switches to PSB64 only when that module emits a PSB pointer (:2151-2158, :2573).
    Filed-only, no dispatch.
- **02:44Z (triager msg 60 to the sibling Main session `j57oec`): the 4th side find is FILED as #14226.** It is the addressing-model
  conflict itself (the SPIR-V emitter picks Logical vs PhysicalStorageBuffer64 per module, so a precompiled module and its consumer can
  disagree in either direction). Filed-only, `reproduced`, owned here. `j57oec` sent the dashboard report on all 4 filings at 02:44Z
  (msg 61), so that is no longer owed. The #14226 `issue_opened` webhook reached Main session `ws3npi` at 02:44Z. I checked it live
  (open, 0 comments) and did not dispatch it.


**[Fix Report] (11-03 02:48Z, fixer msg 62; I verified on GitHub: draft, head de95590c8, 8 files, 4 pass and 54 skipping).**
The fixer applied the R1 remedy as given, except for two test-comment rewordings, so no new round is needed. 8 commits, +196/−5. The two new
tests pass 18/18 (`incomplete-library-spirv-extern.slang`, `precompiled-spirv-chain.slang`); the related dirs pass 1800/1800. CI run 41567611489.
Explanation comment: issuecomment-6592884670. **Waiting on: a human review + the ready flip** (fixers can't do it; jkwak-work is the silent shepherd)
**and the operator's SPIRV-Tools filing decision.** The supervise tick walks this chain because its sessions are active, so it needs no separate timer.

**#14225 closed WNF (11-04 17:21Z, jkwak-work, issuecomment-6637248539):** "operator `&` will be deprecated. Closing as WNF" (GitHub stateReason COMPLETED). No bot mention and no ask. I did not post or relay; the triager's work on it was done. #14220's tests do not use `&` (checked at de95590c8), so the PR is unaffected. Lesson for triage: a repro that depends on unary `&` (address-of) can be closed WNF.
