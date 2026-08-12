---
title: "[approver/human-agreement] #12119 shape-independent OptiX SBT __ldg exclusion MERGED with independent approval — the advisory 🟡 gaps I cleared were exactly the author's later follow-ups (conservative-lean advisory bar validated)"
type: learning
topic: review-approval
source: learnings/1784672659958-approver-human-agreement-12119-shape-independent-o.md
---

# [approver/human-agreement] #12119 shape-independent OptiX SBT __ldg exclusion MERGED with independent approval — the advisory 🟡 gaps I cleared were exactly the author's later follow-ups (conservative-lean advisory bar validated)

**PR:** shader-slang/slang#12119 — MERGED 2026-07-21T22:21Z, `reviewDecision=APPROVED` with a genuine independent maintainer approval (**jkwak-work APPROVED**, not the author, not a bot). `mergedBy=szihs` (the author) but that is NOT a weak self-merge here because independent APPROVED existed. I decided WOULD_APPROVE (CLEAN) on two revisions (R1 @cab4543af5fa PRIMARY 0🔴/3🟡, R2 @8de9683706f8 PRIMARY 0🔴/2🟡/1🔵). Both joined as **APPROVED = agreement (calibration hits).** This is the vindicated successor to the #11152 false-safe — the correct producer-layer fix.

**Calibration mined from the decision→merged diff:** the PR advanced past my last-reviewed head (8de968) to a merged head (e5c7b14) — mostly a master-merge (34 commits of unrelated work), but the PR's OWN files did change. Diffing just the PR files (8de968 → e5c7b14) showed the author's follow-ups were **exactly the advisory 🟡 gaps I had cleared as non-blocking**:
1. **Test CHECK-NOT robustness** (the Gap 1 both bot revs flagged and I judged advisory "no current trigger"): the author added the bracketing `//CHECK-NOT: __ldg` BEFORE the `//CHECK: optixGetSbtDataPointer` anchor in both negative tests (and `CHECK_STRUCT-NOT`), with a comment noting a regressed `__ldg` can land before OR after the anchor (in a `slang_ldg` helper emitted earlier, or inline). This is precisely the suggested fix. My "advisory, the fix correctness is independently verified and the current emit order places `__ldg` after the anchor" call was right — AND the author tightened it anyway for robustness. Clearing it (not BLOCK/ABSTAIN) was correct.
2. **Peel-set refinement** (the 🔵 Question about the op-list): the walker dropped `kIROp_NodeOutputRecordGetElementPtr` (can't sit on an SBT-read chain — work-graph output records) and added `kIROp_PtrCast` (another forwarding cast legalization can produce). Both changes are in the safe direction and preserve the shape-independent property; my failure-direction/blast-radius reasoning still holds at the merged head.

**Transferable takeaways:**
- **The conservative-lean advisory bar is calibrated correctly for test-robustness gaps on a fix whose correctness is independently provable.** When a 🟡 gap is "the test might not catch a regression" but (a) the fix itself is verified correct and (b) the regression it guards has no current trigger, CLEAR-as-advisory is the right call even though a diligent author will later tighten the test. Do not inflate such gaps to OPEN_GAP/ABSTAIN — that would have been a false-block here.
- **On a synchronize burst that outpaces the approver, the merged-head diff of the PR's OWN files (not the raw compare, which is dominated by master-merge noise) is the calibration gold.** Filter `gh api compare` to the PR's touched files, or diff each file at your-head vs merged-head directly, to separate "the author addressed my/the bot's advisory points" from "unrelated rebase churn."
- **`mergedBy == author` is NOT automatically a self-merge/weak signal** — check `reviewDecision` and the per-review states for an independent non-author, non-bot APPROVED first. Here jkwak-work's APPROVED makes it a full endorsement.
- The op-set the walker peels can legitimately be refined post-approval (drop an unreachable op, add a newly-relevant cast) without invalidating a shape-independent-property approval — re-verify the property holds, not that the exact op-list is frozen.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784672659958-approver-human-agreement-12119-shape-independent-o.md`_
