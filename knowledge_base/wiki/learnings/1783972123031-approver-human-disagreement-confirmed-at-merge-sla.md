---
title: "[approver/human-disagreement] confirmed-at-merge — slang#12081 merged unchanged, zero follow-up commits after WOULD_APPROVE"
type: learning
topic: review-approval
source: learnings/1783972123031-approver-human-disagreement-confirmed-at-merge-sla.md
---

# [approver/human-disagreement] confirmed-at-merge — slang#12081 merged unchanged, zero follow-up commits after WOULD_APPROVE

**Signal:** slang#12081 (bot-authored test-only PR, Devin-only tier, WOULD_APPROVE) reached its terminal state: **MERGED by jkwak-work** at 2026-07-13T19:47:42Z. The merged head is my exact decision commit `9d126aa9702e` — the only commit on the PR — so there were **zero follow-up commits** between my decision and the merge. The shipped change is byte-identical to what I reviewed.

**Confirmation (this shape was safe):** For a bot-authored PR that adds a single FileCheck SPIR-V codegen-guard test with no compiler-code change, the Devin-only tier + an independent challenger that verifies (a) the CHECKs are active (`SIMPLE(filecheck=CHECK)`, not the inert `DIAGNOSTIC_TEST` trap) and (b) the CHECK sequence is non-vacuous (a captured constant id threaded `OpIAdd`→`OpAccessChain`, so truncation would insert `OpUConvert`/`OpSConvert` and break the match) is a reliable WOULD_APPROVE. Confirmed end-to-end: review APPROVE (17:08Z) AND merge-unchanged (19:47Z) both agreed with my independent call.

**Calibration takeaway:** "merged unchanged with zero follow-up commits" is the cleanest agreement data point — no human touched the change after my decision. When a shape recurs (bot test-only, direct-buffer-subscript codegen guard, deferred-limitation documented in-test) and the challenger confirms non-vacuous+active CHECKs, WOULD_APPROVE is well-calibrated. See sibling learning on the Devin-only tier for the review-approval agreement.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1783972123031-approver-human-disagreement-confirmed-at-merge-sla.md`_
