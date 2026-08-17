---
title: "[approver/human-disagreement] Demo/example doc-inconsistency OPEN_GAP shipped as-is via author self-merge"
type: learning
topic: review-approval
source: learnings/1784111092025-approver-human-disagreement-demo-example-doc-incon.md
---

# [approver/human-disagreement] Demo/example doc-inconsistency OPEN_GAP shipped as-is via author self-merge

**Symptom:** On shader-slang/slang#12090 I decided ABSTAIN_POLICY(OPEN_GAP), driven by a README internal inconsistency in the shader-coverage demos (two untouched Architecture-table rows still stating the old single/whole-image dispatch default after the PR flipped full mode to batched/tiled). The PR then MERGED at my exact decision head `de31f60b15a3` — one commit, ZERO follow-up commits — so the flagged README rows were NOT fixed before merge. Merged by the PR author themselves (jvepsalainen-nv self-merge). Human verdict = APPROVED.

**Root cause / correct read:** This is a decision/human mismatch (I withheld; human shipped as-is), but it is NOT a false-safe (I didn't approve something later rejected) and NOT strong evidence my bar was wrong: (1) a *self*-merge by the PR author is weak calibration signal — much weaker than an independent maintainer's explicit approval; authors routinely self-merge demo/example PRs past minor doc nits that no independent reviewer looked at. (2) The abstain arguably worked as designed — ABSTAIN_POLICY means "a human should look," nothing blocked (shadow mode), and a human dispositioned the flagged item as non-blocking. (3) A stale architecture-table row is exactly the low-visibility thing that slips through unnoticed, which is the reason it's defensible to surface it.

**How to catch it / calibrate:** For doc-only OPEN_GAPs in DEMO/EXAMPLE code (examples/**, not user-guide/reference docs), weigh two things the next time: (a) the blast radius is low (a reader of a demo README, not an API contract) and (b) such PRs are frequently author-self-merged, so the realistic outcome is "shipped as-is." That doesn't mean round UP to WOULD_APPROVE — approving would silently bless a self-contradictory doc, and the conservative-lean rubric legitimately abstains when a gap undermines the PR's stated purpose. It means: keep flagging (surfacing is the value), but EXPECT the human may ship it, and don't treat a subsequent as-is merge as a false-safe or a strong "you were too strict" signal. Reserve the stronger self-correction for cases where an INDEPENDENT maintainer approves over a gap I flagged, or where a WOULD_APPROVE meets CHANGES_REQUESTED.

**Fix:** No procedure change — the flag-and-abstain was correct and useful. Recorded as calibration: demo-doc internal-inconsistency OPEN_GAPs are real but low-severity and commonly self-merged; the human outcome here neither vindicates nor refutes the bar strongly. Related to `[approver/critique-mustfix]` (reading the whole file is what SURFACED the gap in the first place — that part was unambiguously right).

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784111092025-approver-human-disagreement-demo-example-doc-incon.md`_
