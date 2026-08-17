---
title: "[approver/calibration] #11917 comment-only-delta re-verdict rode to merge with zero follow-up — the byte-identical-logic shortcut was safe (confirmed on #11987)"
type: learning
topic: review-approval
source: learnings/1784063797593-approver-calibration-11917-comment-only-delta-re-v.md
---

# [approver/calibration] #11917 comment-only-delta re-verdict rode to merge with zero follow-up — the byte-identical-logic shortcut was safe (confirmed on #11987)

## Confirmed-safe shape
#11987 ("Skip legalizeMatrixTypes when no matrix needs legalizing", #11917 slice)
MERGED @21:14:05Z by jkwak-work, merge commit 6d299e4, merged head =
`5b16405c3279` = my R2 decision head EXACTLY. **Zero follow-up commits between
my decision and the merged code**; both maintainers approved (pdeayton on the
R1 SHA 25974dfe6cea, jkwak on the R2 head). Both my ledger rows were
WOULD_APPROVE/CLEAN → clean agreement on both revisions.

## The shape that was safe
R2 was a `synchronize` whose delta from R1 was ONE comment-only commit (14 `//`
lines deleted, 0 code changes, verified by full-file diff). I re-ran the full
procedure but shortcut the challenger's substantive step: because every
executable statement was byte-identical to the R1 SHA I'd already proven a safe
superset, I carried the #11917 stale-FALSE safe-superset reasoning forward
rather than re-deriving it. **The merge confirms that shortcut was correct** —
a comment-only delta cannot change compiler behavior, so a prior CLEAN logic
verdict transfers to the new SHA once you've PROVEN the delta is comment-only
(full-file diff, not just the compare summary or the commit message).

## The one risk in this shape, and how it was handled
The deleted comment was a maintainer tripwire ("revisit shouldLowerMatrixType if
a new lowering target is added"). Devin surfaced its loss as a new informational
(:83-92). Correct call was CLEAR-as-advisory: it's a documentation loss with no
current-target trigger, and the maintainer explicitly requested the removal. The
merge (by that same maintainer) confirms advisory-clear was right — a deleted
doc-comment is not a gap that blocks when the reviewer asked for it.

## Transferable rule
For a `synchronize` re-verdict: (1) prove the delta is comment/whitespace-only
by DIFFING THE FULL SOURCE at both SHAs (grep that no removed/added line is
non-comment), not by trusting the compare summary; (2) if proven inert, a prior
CLEAN logic verdict rides to the new SHA — re-run clauses + a fresh Devin +
critique gate, but the deep safe-superset re-derivation can be carried; (3)
re-trigger the FULL challenger the moment ANY code line moves. Adjacent standing
guardrail from [[approver-clause-gap-standing-decision-rides-codegen-inert]]
(#12080): codegen-inert nit-polish rides the standing decision; a mislabeled
emit delta must re-trigger. Same principle, comment-level here.
Related: [[pr-11987-human-agreement]], [[pr-12088-decided]] (#11917 epic).

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784063797593-approver-calibration-11917-comment-only-delta-re-v.md`_
