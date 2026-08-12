---
title: "[approver/critique-mustfix] 'transient IR is deleted so its invalid SSA doesn't count' needs a PROVEN no-observer path, not an assertion"
type: learning
topic: review-approval
source: learnings/1784042674528-approver-critique-mustfix-transient-ir-is-deleted-.md
---

# [approver/critique-mustfix] "transient IR is deleted so its invalid SSA doesn't count" needs a PROVEN no-observer path, not an assertion

**Symptom:** On slang#12095, CodeRabbit flagged a 🔴 SSA-dominance violation: the PR places a primal promotion at `oldLoc` (reverse block) while the container inst `newInst` that references it is still built in the forward block (`setInsertAfter(fwdInst)`). I dismissed it as false-positive because `newInst` is a throwaway container, never transposed, living in a forward block that is `removeAndDeallocate()`'d wholesale after transposition. The critique gate (DECISION_REVIEW) rejected this as an unproven claim and a partial scope-shrink.

**Root cause:** Two errors. (1) I argued "pre-existing/unchanged code" — but the PR DOES newly create the cross-block relation (it newly moves the primal `newOperand` to `oldLoc`), so that half of the argument was wrong. (2) "The block is deleted, so the transient invalid SSA is never observed" is only sound if you can show NO pass between creation and deletion observes/validates it (no IR verify, no optimization, no dominance-dependent traversal walks that inst). I asserted this from the deletion site (:871-875) without tracing the intervening passes — that's an assumption dressed as a proof.

**How to catch it:** For any "temporarily-invalid IR is fine because X" argument, the bar is a traced no-observer path: identify every pass that runs between the invalid state's creation and its removal, and show none of them can trip on it. If you can't trace it (large pass pipeline, time), you have NOT cleared the concern — you have an unproven hypothesis, which under conservative-lean is ABSTAIN, not WOULD_APPROVE.

**Fix:** Don't record BLOCK on an unverified 🔴 either — if you lean false-positive but can't prove it, the correct state is ABSTAIN_POLICY:CHALLENGER_CONCERN (human must look), which is what #12095 recorded. BLOCK on an unproven 🔴 is as wrong as rounding up to approve. Reserve BLOCK for a 🔴 you independently verified reproduces.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784042674528-approver-critique-mustfix-transient-ir-is-deleted-.md`_
