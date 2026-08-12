---
title: "[approver/human-agreement] recall-predicted-hpp-emitter-fix-WOULD_APPROVE-vindicated-full-arc"
type: learning
topic: review-approval
source: learnings/1785339839478-approver-human-agreement-recall-predicted-hpp-emit.md
---

# [approver/human-agreement] recall-predicted-hpp-emitter-fix-WOULD_APPROVE-vindicated-full-arc

## Symptom / outcome
shader-slang/slang#12152 "Fix #9403: emit compute entry-point wrappers as prototypes in -target hpp" (nv-slang-bot fixer PR) was decided **WOULD_APPROVE (CLEAN)** @9148d9a7b679 on the Devin-only fallback tier. **MERGED @ the EXACT decision head** (only one commit; merge commit 71a3f7e7) after **pdeayton-nv (non-author) APPROVED** at the byte-identical SHA. human_verdict=APPROVED → **full-arc AGREEMENT, not a false-safe.**

## Root cause / why the confidence was warranted
This is the calibration confirmation for the WOULD_APPROVE path when three things line up:
1. **Step-0 recall had triaged the SAME issue (#9403) earlier and predicted the exact principled fix shape**, AND the actual diff matched that prediction axis-for-axis when verified against source at the pinned head (see [[pr-12152-decided]] and the sibling learning recall-predicted-fix-shape-verify-diff-matches-prediction). A recall-predicted fix that the diff confirms is a very strong prior.
2. **Small, self-contained emitter change** (3 files, +66/-2): guard the compute-wrapper loop on `shouldEmitOnlyHeader()` (= `m_target==CodeGenTarget::CPPHeader`, hpp-only), emit prototypes, extract shared signature helper preserving the def path byte-identical. Blast radius provably confined to `-target hpp`.
3. **The regression test actually reproduces** — uses `[shader("compute")] __extern_cpp void example(){}` (roots against DCE) with `//CHECK-NOT: _example`; fails pre-fix, and the CPU host `test-slang` CI legs that run it were already green.

## How to apply
For host/emitter codegen fixes (`-target hpp`/`cpp`/CUDA) where (a) recall predicts the fix and the diff matches, (b) the guard/override provably scopes the change to one target, and (c) a reproducing FileCheck test is green on the CPU test-slang legs — WOULD_APPROVE on a Devin-only tier is calibrated correctly even without a production github-actions review. A non-author maintainer (pdeayton-nv) approved and merged at the identical head with zero follow-up commits, confirming the read. Contrast with false-safe cases where a design/representation gap had no triggering test ([[pr-12098-awaiting-join]], [[pr-12156-decided]]) — here there was no such latent gap; the change is purely a header-emission mode switch with a direct compile/link test.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785339839478-approver-human-agreement-recall-predicted-hpp-emit.md`_
