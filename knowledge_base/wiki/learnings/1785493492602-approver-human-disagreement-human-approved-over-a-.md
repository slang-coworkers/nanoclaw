---
title: "[approver/human-disagreement] Human APPROVED over a shadow-only ABSTAIN — a merge over an unposted finding is NOT evidence the finding was wrong; don't relax the bar"
type: learning
topic: review-approval
source: learnings/1785493492602-approver-human-disagreement-human-approved-over-a-.md
---

# [approver/human-disagreement] Human APPROVED over a shadow-only ABSTAIN — a merge over an unposted finding is NOT evidence the finding was wrong; don't relax the bar

**Symptom:** slangpy#1075 — I recorded ABSTAIN_POLICY:OPEN_GAP at head `d001b2b` (R9) on a test-integrity concern: the newly-added Gap B regression test failed deterministically on the Metal backend (reproduced texel `memcmp` mismatches on the generated mips of the batched texture-array path), and the immediately-following "portability fix" push removed the generated-mip assertions to green it rather than explaining the divergence. ~5 min later tdavidovicNV APPROVED (empty body, 10:21) and ccummingsNV merged at the SAME head `d001b2b` (10:22, merge commit 817ec8c). Human verdict recorded APPROVED. So on the join, my ABSTAIN "disagrees" with a human APPROVE+MERGE.

**Root cause / the calibration trap:** We run SHADOW mode and NEVER post to GitHub. My R9 test-integrity finding existed only in the ledger + our dashboard — it was never visible to tdavidovicNV. The approval had an empty body and there is no evidence (no comment, no follow-up commit re-adding the mip assertions) that the maintainer engaged with the removed-mip-assertion / Metal-divergence concern. The merged head is byte-identical to my decision head — the concern shipped unaddressed. Therefore this join is NOT evidence my ABSTAIN was wrong. It is a human approving green (CI + the now-weakened test) WITHOUT visibility into a shadow-only finding.

**Why this matters (the feedback-loop guard):** Accuracy is measured by joining decisions against human outcomes, and the naive lesson from "my ABSTAIN, their APPROVE" would be "I'm over-conservative, relax toward approve." That is exactly the wrong update when (a) the finding was never surfaced to the human, and (b) the technical concern is real and unaddressed in the merged code. Rounding the bar down here would train the approver to rubber-stamp whatever humans merge — defeating the point. Invariant reaffirmed: never round up to match a human; a human APPROVE over an unposted shadow finding does not retroactively clear the finding.

**How to handle it:** (1) Still `record_human_verdict` (APPROVED) — the join data is honest even when the disagreement is explainable; don't suppress it. (2) In the disagreement analysis, explicitly classify whether the human HAD VISIBILITY into the concern: check the approval's body (empty here), any review comment referencing it, and whether a follow-up commit addressed it (none — merged at the decision head). No-visibility ⇒ label it "divergence without informed disagreement," NOT "approver was wrong." (3) The merge closes the pre-merge "nudge a human to look before it lands" window — but if a reproduced backend defect shipped with its regression test disabled, that's a post-merge FYI worth surfacing to the operator (a follow-up issue / main-branch flag), because it's now in `main`. (4) Do NOT weaken future gap/test-integrity severity on the strength of this join. See [[slangpy-1075]] and the sibling learning [approver/false-safe] "test weakened to green a reproduced failure."

**Distinction from a true false-safe:** A false-safe is WOULD_APPROVE where the human then requested changes (I asserted safe, was wrong — highest severity). This is the inverse and much lower severity: I asserted "human must look," a human looked (or at least approved) and merged. The residual risk isn't a bad approver call — it's that the thing I flagged may be a real shipped defect the human didn't examine.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785493492602-approver-human-disagreement-human-approved-over-a-.md`_
