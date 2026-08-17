---
title: "[approver/human-disagreement] closed-unmerged ≠ rejection — check for a supersede/fold-into-open-PR before mapping the merge outcome to a human verdict"
type: learning
topic: review-approval
source: learnings/1784012759272-approver-human-disagreement-closed-unmerged-reject.md
---

# [approver/human-disagreement] closed-unmerged ≠ rejection — check for a supersede/fold-into-open-PR before mapping the merge outcome to a human verdict

## Symptom
slang#12082 reached github.pr_closed with merged=false. The skill's calibration rule maps "closed-unmerged ⇒ CHANGES_REQUESTED/REJECTED-equivalent human verdict." Taken literally that would score my two WOULD_APPROVE rows (d23f8eb, e04ce4ff) as false-safes and my rev4 ABSTAIN as vindicated. All wrong.

## Root cause
The close was BENIGN — a supersede, not a merits rejection. The author's own closing comment: "Folded into #12086 per maintainer decision — the README edits of the two PRs conflicted, and both are the documentation/presentation layer. The full glossary + README refresh content is preserved there (merge commit cbbf364)." Closed by the AUTHOR, content preserved, successor PR #12086 OPEN. "closed-unmerged" is a coarse signal; the merge boolean alone can't tell rejection from consolidation/abandonment/split.

## How to catch it
On any github.pr_closed with merged=false, BEFORE calling record_human_verdict, read the close context:
  gh api graphql ... timelineItems(itemTypes:[CLOSED_EVENT, ISSUE_COMMENT, CROSS_REFERENCED_EVENT])
- WHO closed it? Author-closed ⇒ likely abandon/supersede; maintainer-closed with a "not the right approach" comment ⇒ genuine rejection.
- Is there a CROSS_REFERENCED / "folded into #N", "superseded by #N", "replaced by #N", "moved to #N" comment? Follow #N: if it's open/merged and carries the content, this is a supersede, NOT a rejection of your decision.
- Map accordingly: supersede/abandon ⇒ record a SUPERSEDED/benign verdict with the reason, and do NOT count it as a false-safe against a WOULD_APPROVE row. Genuine merits-close ⇒ the REJECTED mapping applies and a WOULD_APPROVE there is a real false-safe.

## Bonus signal — trace whether your open concern survived the fold
My rev4 OPEN_GAP (invariant contradicted by loop timers apiWriteModule / rt-composite apiFindEntryPoint) traveled UNRESOLVED into the successor #12086 (verbatim at its api-driver.cpp:29-30). So the concern is still live, not refuted — worth noting on the verdict so the successor's review picks it up. When content folds into another PR, grep the successor head for the exact thing you flagged: it tells you if the fold fixed it or just carried it.

## Fix / rule
Never map a merge boolean to a human verdict blind. closed-unmerged is rejection ONLY when the close is on the merits; supersede/fold/abandon are benign and must be recorded as such so agreement-scoring isn't poisoned. Related: [[the-pre-existing-attribution-test-cuts-both-ways]] (the rev4 OPEN_GAP this one traces forward).

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784012759272-approver-human-disagreement-closed-unmerged-reject.md`_
