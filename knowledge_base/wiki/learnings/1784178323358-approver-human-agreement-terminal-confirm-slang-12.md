---
title: "[approver/human-agreement] TERMINAL confirm slang#12064: ABSTAIN/OPEN_GAP merged byte-identical at decided head, coverage gap unaddressed — withhold-on-SAFE agreement, not false-safe"
type: learning
topic: review-approval
source: learnings/1784178323358-approver-human-agreement-terminal-confirm-slang-12.md
---

# [approver/human-agreement] TERMINAL confirm slang#12064: ABSTAIN/OPEN_GAP merged byte-identical at decided head, coverage gap unaddressed — withhold-on-SAFE agreement, not false-safe

**Terminal calibration datapoint (slang#12064, external-fork SPIR-V Flat-decoration fix).** My rev2 decision: ABSTAIN_POLICY / OPEN_GAP @ head `95f1ebf2d272` (gap #2 = no non-fragment negative test / composite-mask test absent). Human outcome: **MERGED by jkwak-work at EXACTLY that head** (mergeCommit 6c837d31, merged 2026-07-16), with an explicit APPROVED review at the same SHA — not a bare self-merge, zero follow-up commits, the coverage gap left unaddressed. Recorded human_verdict=MERGED_APPROVED for the rev2 row; the earlier rev1 row (@ da4d3e, byte-identical logic, same OPEN_GAP call) recorded SUPERSEDED_BY_LATER_REVISION.

**Scorer axis:** withhold-on-SAFE. This is AGREEMENT in the conservative direction — NOT a false-safe. I never approved-on-unsafe; the code was proven correct three ways (head-current github-actions[bot] review explicitly "behavior-preserving + value-type path correct, verified vs emitBuiltinVar + entry-point ref graph"; Devin 0 bugs/0 flags; the fixer's local-build verification of the composite uint4-mask path). The only divergence was approve-vs-withhold on a missing test.

**The sharpened class signal (now CONFIRMED, not hypothesis):** when a small, behavior-preserving fix has its ONLY open finding be a missing negative/coverage test — AND correctness is independently corroborated (a completed head-current review + Devin + any local-build evidence) — the maintainer bar is "merge it, the test is follow-up." This is the same pattern as #12037 and #12041, now with a terminal MERGE confirming it (not just an approve-over-abstain). The shadow ABSTAIN is procedurally correct (Step 2/3 still force OPEN_GAP on any non-pre-existing 🟡 gap) and must keep being made — but frame it as conservative-by-design / low-concern in the report, prominently citing the corroborating correctness evidence, so humans don't read ABSTAIN as "something's wrong."

**Also confirmed (feeds the synchronize learning):** the rev2 head was a pure "Merge branch 'master'" commit; the PR's own diff stayed byte-identical to rev1 and merged that way. A master-merge synchronize neither closes a held gap nor changes the decision — it just re-pins the head. The whole 2-revision chain (rev1 ABSTAIN, rev2 ABSTAIN, merge) held the same conservative call on the same effective change and agreed with the human in the withhold direction each time.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784178323358-approver-human-agreement-terminal-confirm-slang-12.md`_
