---
title: "[approver/human-agreement] BLOCK on PR-caused red CI vindicated by fix-then-merge trajectory (#12130)"
type: learning
topic: review-approval
source: learnings/1784177389034-approver-human-agreement-block-on-pr-caused-red-ci.md
---

# [approver/human-agreement] BLOCK on PR-caused red CI vindicated by fix-then-merge trajectory (#12130)

**PR:** shader-slang/slang #12130 (#12046 GLSL float-remainder + SPIR-V OpFMod fix, bot fixer branch). My decision: BLOCK (RED_BUG:test-slang-metal-fmod-count) @ a891de261b27, Devin-only tier.

**Outcome — BLOCK vindicated by trajectory, not merge-at-head.** The PR MERGED (5bd8eb89, by jkwak-work) but NOT at my blocked head. A follow-up commit `200d6f5f3905` "Update stale Metal fmod filecheck counts after single-token emission" changed EXACTLY the two files my BLOCK's next-action named — `tests/metal/math-scalar.slang` (`METAL-COUNT-2: fmod(`/`METALLIB-COUNT-2: fmod.f32` → `METAL: fmod(`/`METALLIB: fmod.f32`) and `tests/metal/math-vector.slang` (`METAL-COUNT-2: fmod(` → `METAL: fmod(`). jkwak re-APPROVED at 03:30:44Z only AFTER that fix, then merged at the fixed head 04:46:51Z. Recorded human_verdict = SUPERSEDED_CHANGES_REQUESTED against my decided row.

**Calibration lesson (the transferable part).** When you BLOCK on a PR-caused red CI, the correct join on a later merge is NOT "merged ⇒ APPROVED-equivalent ⇒ I was wrong." First diff the decided head against the merged head: if the follow-up commits are the fix you demanded, the merge VINDICATES the BLOCK (SUPERSEDED_CHANGES_REQUESTED), it does not contradict it. The naive "merged = agreement-if-WOULD_APPROVE / disagreement-if-BLOCK" mapping only holds when the merged head is byte-identical to the decided head. This is the #12106-R1 pattern: R1 BLOCK on a PR-caused CI regression, next commit removed exactly the implicated code, merged at the fixed head → BLOCK vindicated. Same shape here.

**Reinforces:** the sibling [approver/false-safe] "Metal intrinsic token-count change breaks untouched Metal COUNT tests; ci_green clause is blind to check-runs" — this merge outcome confirms that (a) the red CI was real and author-owned, and (b) probing check-runs (not the combined-status API, which reported success) is what caught a genuine defect Devin+the-premature-human-APPROVE missed. Related: [[pr-12106-decided]], [[pr-12130-decided]].

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784177389034-approver-human-agreement-block-on-pr-caused-red-ci.md`_
