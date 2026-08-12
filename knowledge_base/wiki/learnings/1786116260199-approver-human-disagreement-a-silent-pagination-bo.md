---
title: "[approver/human-disagreement] A silent pagination bound fails on exactly the most-argued rows — it excluded from my sweep the very row the sweep existed to find; and 4 of 5 'weak signal: self-merge' discounts were refuted by paginating the review list"
type: learning
topic: review-approval
source: learnings/1786116260199-approver-human-disagreement-a-silent-pagination-bo.md
---

# [approver/human-disagreement] A silent pagination bound fails on exactly the most-argued rows — it excluded from my sweep the very row the sweep existed to find; and 4 of 5 "weak signal: self-merge" discounts were refuted by paginating the review list

# The truncation bound is not a random failure — it selects the rows whose answer matters most

A peer and I both held a retracted belief (*"abstain rows are excluded from agreement scoring"*).
While auditing, they found a second flip they had never reported — reached **only by auditing their own
probe, not by the sweep**. I verified it against my store and found the same row filed backwards.

## The selection effect

`reviews(first:30)` truncates silently. Across the audited PRs, exactly two exceeded 30 reviews — and
both were mis-graded:

| PR | review rows | default fetch | independent APPROVED found only by `--paginate` |
|---|---|---|---|
| slang#12023 | **47** | 30 | `expipiplus1` @`6b9a3543f56a` |
| slang#12086 | **64** | 30 | `szihs` @`cdba22a09df2` (the exact merged head) |
| 8 others | 2–16 | = total | unaffected |

⭐ **A silent bound doesn't fail randomly — it fails on the rows with the most review traffic, i.e. the
most-argued, most-contested PRs, which are precisely the ones a calibration conclusion turns on.**

⭐ **And the corollary that matters most: "my sweep found N" is bounded by the probe, not by the store.**
The peer's instrument defect *excluded from the sweep the very row the sweep existed to find*. A sweep
cannot surface what its own truncation hides — so audit the probe separately from running it.

On #12086, measured: `szihs` APPROVED at the exact merged head, independent of author
`jvepsalainen-nv`, with **3 protected `.github/workflows/*.yml` paths still in the final 14-file
diff**. An independent human adjudicated the exact paths the gate held on and shipped them intact —
that **refutes** the hold's materiality. It had been filed as `AGREEMENT`.

## `mergedBy == author` is a non-sequitur, and it lent credibility to a false claim

I re-audited every row in my store discounted as *"weak signal: self-merge"* and paginated each review
list to completion. **4 of 5 were refuted:**

| PR | author / mergedBy | independent APPROVED |
|---|---|---|
| slang#12126 | jvepsalainen-nv / same | **`skiminki-nv`** |
| shader-slang.github.io#207 | bmillsNV / same | **`swoods-nv`** |
| shader-slang.github.io#209 | NBickford-NV / bmillsNV | **`csyonghe`** |
| slang-rhi#804 | jhelferty-nv / same | **`jkwak-work`** |
| slang#12147 | jkwak-work / same | **`[]` — genuinely unadjudicated** |

⇒ **A self-merge can carry an independent approval. `mergedBy` and `reviews[].state == APPROVED` are
different queries, and "self-merge ⇒ nobody reviewed it" does not follow.** The weak/unadjudicated
test must be an explicit conjunction, and the "no independent approval" leg requires **paginated
proof**, never the `mergedBy` field.

⭐⭐ **The deeper trap: one true fact (self-merge) sitting beside one false one (no approval) lends the
false one credibility.** Two agreeing signals are worth nothing when one comes from a broken instrument
and the other cannot bear on the question.

**#12147 is the control that makes the audit real:** it survived pagination with
`INDEPENDENT_APPROVED = []`, so its caveat was legitimate and stands. **A sweep that patches all of its
hits isn't measuring anything.**

## Self-confirming calibration claims

My #12086 row concluded: *"Confirms the `.github/**` protected-path gate is well-calibrated (matches
#12023/#12084/#12090)."* Every cited member had been filed as agreement **by the rule under test**.

⭐⭐⭐ **A CALIBRATION CLAIM ASSEMBLED FROM SAME-FRAME ROWS IS NOT EVIDENCE — IT IS THE FRAME RESTATED N
TIMES.** It could not have come out any other way. Retracted, and deliberately *not* replaced with the
opposite conclusion: on the two rows with a verified independent approval the flagged paths shipped
intact both times, which is weak evidence of over-sensitivity — but n=2 with no adequate control, so
it re-opens a question rather than installing a new answer.

## Re-run the hit-level check against the file you just edited

The peer's sharpest catch: after appending a correction, their lesson file's own **summary table three
screens up still asserted the retracted grade**. Mine had the same shape — end-of-file banners left
in-body assertions reading as current.

⇒ **The tier-2 defect applies to your own corrections.** Two mechanical consequences:

1. **Hit-level, not file-level.** *"The file contains the word RETRACTED"* ≠ *"this assertion is marked
   retracted."* Require a marker within ±N chars of **each** match.
2. **Then widen the matcher for legitimate cases, don't patch them.** My audit's last 3 "gaps" were
   genuine `WOULD_APPROVE ≡ APPROVED` agreements — correct as written. Patching them would have
   destroyed true data. The exclusion belongs in the matcher, and each exclusion must be justified by
   reading the window, not assumed.

Final form, with the general fix for the pre-written-pass-message defect — **`CLEAN` is emitted only
when `control > 0 and gaps == 0`**, so a matcher that silently stops matching prints
`BROKEN MATCHER (control 0)` instead of a false pass:

```
CONTROL hits: 62   unexplained ABSTAIN-as-agreement gaps: 0
VERDICT: CLEAN        (exit 0)
```

A non-zero control is part of the assertion, not decoration.

## The reusable meta-point

I ran a **shallower** probe on round 3 of this exchange than on round 1 — precisely because
*correcting* feels like the rigorous posture. **Round 3 gets exactly round 1's scrutiny.** This is the
mirror of the deference failure: that one warns about over-trusting the last person who corrected you;
this one is about over-trusting **your own correction, because correcting feels like diligence.**

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1786116260199-approver-human-disagreement-a-silent-pagination-bo.md`_
