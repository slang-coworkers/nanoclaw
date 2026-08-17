---
title: "[approver/human-disagreement] RETRACTION of the slangpy#1075 'ABSTAIN vindicated' learning — it was factually wrong; the PR merged AT my decision head over a shadow-only finding"
type: learning
topic: review-approval
source: learnings/1785493972914-approver-human-disagreement-retraction-of-the-slan.md
---

# [approver/human-disagreement] RETRACTION of the slangpy#1075 "ABSTAIN vindicated" learning — it was factually wrong; the PR merged AT my decision head over a shadow-only finding

**This RETRACTS and supersedes the earlier learning file** `1785493520816-approver-human-agreement-slangpy-1075-abstain-vind.md` ("[approver/human-agreement] slangpy#1075 ABSTAIN vindicated: both OPEN_GAPs fixed before merge…"). That file is **factually wrong** and must NOT be used for calibration. I could not edit/delete it directly — the shared learnings dir is read-only to the approver container (writes only go through `append_learning`) — so this atom is the correction of record. An operator or the wiki-sync should drop or tombstone the retracted file.

**The false claims in the retracted file:**
1. That my final decision commit was `e65086` and the merged head `d001b2ba` was a *different, later* commit, with the two gap-fixes pushed *between* them.
2. That the merge therefore VINDICATED the ABSTAIN (scored as AGREEMENT).
3. That the new `texture_loader_batched_uploads` regression test proved the human loop worked.

**The verified facts (from live GitHub state, 2026-07-31):**
1. My final shadow decision (R9) was at head **`d001b2bad242`** (ABSTAIN_POLICY:OPEN_GAP, 10:16). The PR **MERGED at that SAME head** (merge commit `817ec8c`, 10:22, ccummingsNV self-merge). **No commits exist between my decision head and the merged head** — identical trees. Nothing was fixed "between them"; the concern shipped unaddressed.
2. tdavidovicNV's APPROVED (10:21) was **empty-bodied** and post-dated my finding by ~5 min; the finding was **shadow-only, never posted to GitHub**. So this is a **divergence WITHOUT informed disagreement**, not an agreement/vindication.
3. `texture_loader_batched_uploads` is exactly the test that FAILED DETERMINISTICALLY on Metal (real texel `memcmp` mismatches on the generated mips of the `create_texture_array` path at `b91339d`); the `d001b2b` "portability fix" narrowed it to mip-0-only to green it. Citing it as proof of a working loop is backwards — it's the regression test that was disabled over a reproduced bug.

**Correct calibration (the durable rule):** A `pr_merged` join where the PR merged AT your decision head, over a finding you never posted, with an empty-bodied approval, is **neither vindication nor informed disagreement**. Record the human verdict (APPROVED) honestly for the join, but do NOT score it as agreement and do NOT relax the gap/test-integrity bar. Treating "a human merged green over my shadow finding" as vindication trains the approver to rubber-stamp — the exact false-safe this PR caught. The authoritative learning is `1785493492602-approver-human-disagreement-human-approved-over-a-` (kept). The R3 learning `1785151870935-approver-human-agreement-a-human-approved-commit-c` is also CORRECT — its `e65086` reference is properly scoped to the R3 head; the retracted file's error was conflating R3's `e65086` with the final merged head `d001b2b`. See [[slangpy-1075]].

**Meta-lesson:** when writing a `pr_merged` calibration learning, ALWAYS `gh pr view --json headRefOid,mergeCommit,mergedAt` + compare the merged head to your decision commit before declaring "vindicated" vs "disagreement." If merged head == decision head, no fixes were applied post-decision — it cannot be a "gaps fixed before merge" vindication. The retracted file skipped that check and invented an intervening-fix narrative.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785493972914-approver-human-disagreement-retraction-of-the-slan.md`_
