---
title: "[approver/human-agreement] author self-merge is a WEAK 'APPROVED' signal — a shadow-mode ABSTAIN over a CI-invisible regression is vindicated (not refuted) when the author self-merges it unchanged"
type: learning
topic: review-approval
source: learnings/1784386435249-approver-human-agreement-author-self-merge-is-a-we.md
---

# [approver/human-agreement] author self-merge is a WEAK "APPROVED" signal — a shadow-mode ABSTAIN over a CI-invisible regression is vindicated (not refuted) when the author self-merges it unchanged

## Symptom
shader-slang/slang#12147 R5 was my ABSTAIN_POLICY (CHALLENGER_CONCERN) over a verified false-positive E00111 regression (a "simplify" refactor collapsed R4's deliberate stdout-vs-file `-` distinction). The PR then MERGED at the exact R5 head, unchanged — no R6. On its face "merged ⇒ APPROVED-equivalent" looks like the human disagreed with my ABSTAIN. It does NOT.

## Root cause / calibration nuance
Checking the merge provenance changes the meaning entirely:
- `author == mergedBy == jkwak-work` — an AUTHOR SELF-MERGE.
- Zero independent maintainer APPROVED review (every human review on the PR is jkwak's own COMMENTED, including one on R5 itself). No second human ever weighed the regression I flagged.
- The regression was CI-invisible (no test covers debug-stdout vs coverage-manifest-file-`-`), bot-missed (primary bot: 0 bugs), and I'm shadow-mode so I never posted it to GitHub. So the author almost certainly merged unaware of the pathological dual-`-` edge case.
Therefore "merged" here means "the author shipped their own PR," not "a reviewer considered and rejected the approver's concern." The `record_human_verdict` mapping is still APPROVED (that's the defined join semantics), but for CALIBRATION it is a WEAK signal, not a refutation.

## Why the ABSTAIN was well-calibrated (vindicated both directions)
- The false-positive E00111 regression I flagged is REAL and now LIVE in master (it shipped unchanged) → flagging it was correct; a clean WOULD_APPROVE would have been a miss.
- It was correctly NOT a shipping-blocker → the maintainer shipped it, confirming it wasn't worth a hard BLOCK. A BLOCK/RED_BUG would have been over-strict.
- ABSTAIN was exactly the calibrated middle: surface a real-but-minor regression for a human to weigh, neither clean-approve nor hard-block. This is NOT a false-safe (I didn't approve) and NOT a classic human-disagreement (no independent human refuted it).

## How to catch it (join-scoring discipline)
On any `pr_merged` join, before scoring agreement:
1. Verify the merged SHA vs your decision row (done routinely) — here it merged at the exact ABSTAIN'd head, no later commit fixing the flagged issue.
2. Check `author` vs `mergedBy` and whether any INDEPENDENT maintainer posted an APPROVED review. Author self-merge with no independent approval = weak signal; do not score it as "human reviewed my concern and disagreed."
3. If your decision flagged something CI-invisible / bot-missed / never-posted, a self-merge is affirmatively evidence the concern went UNSEEN, not evidence it was considered-and-dismissed. Record the join verdict as defined (APPROVED) but annotate the calibration as "self-merge, concern likely unseen — ABSTAIN stands."
4. A shadow-mode ABSTAIN whose flagged defect then ships unchanged is the SUCCESS case for ABSTAIN calibration (real enough to withhold, minor enough to ship), not a disagreement to correct toward approval next time. Do not let a self-merge nudge you toward rounding up on similar future changes.

## Fix
Recorded human_verdict=APPROVED for (#12147, 74147f95e614) per join semantics; annotated memory that this is a self-merge weak signal and the R5 ABSTAIN was vindicated in both directions. The verified false-positive (debug-stdout vs coverage/depfile-file-`-` → spurious E00111) is now live in master; observability of that is the orchestrator's follow-up loop (it had logged a trigger to route a reviewer to build-confirm+post if the PR neared merge without a fix; the fast self-merge likely beat it). Approver stays read-only.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784386435249-approver-human-agreement-author-self-merge-is-a-we.md`_
