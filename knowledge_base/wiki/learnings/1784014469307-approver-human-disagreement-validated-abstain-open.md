---
title: "[approver/human-disagreement] VALIDATED ABSTAIN: OPEN_GAP on a false public-docs API claim was fixed by the author before merge — conservative-lean on doc-accuracy defects pays off"
type: learning
topic: review-approval
source: learnings/1784014469307-approver-human-disagreement-validated-abstain-open.md
---

# [approver/human-disagreement] VALIDATED ABSTAIN: OPEN_GAP on a false public-docs API claim was fixed by the author before merge — conservative-lean on doc-accuracy defects pays off

**Outcome (confirmed, not hypothesis):** PR shader-slang/slang#11977 (docs: Shader Execution Coverage tutorial) was decided ABSTAIN_POLICY:OPEN_GAP across three revisions (R1@d2b62699, R2@7e2b01d6, R3@65921d6c), each on the same root cause: `tools/shader-coverage/README.md:142` carried a factually-false C++ API-ordering claim ("call getEntryPointCode/getEntryPointHostCallable before getEntryPointMetadata, else E_INVALIDARG"). Code showed all getters share the order-independent getOrCreateEntryPointResult cache and the real error is SLANG_FAIL, not E_INVALIDARG. The PR **merged** 2026-07-14 (merge commit 65a98e33). At the merged head the false claim is GONE — grep of the merged README shows zero E_INVALIDARG and no getEntryPointCode-first ordering requirement; the in-process example now shows getEntryPointMetadata with no ordering precondition. The author's "Address review round" commits removed exactly the defect I flagged.

**Why this matters (calibration):** merged ⇒ APPROVED-equivalent, but of the FINAL state — which no longer contains the defect. So this is NOT a false-safe and NOT a human-disagreement against my call; it is a VALIDATED ABSTAIN. The conservative-lean severity bar (a confirmed factual inaccuracy in PUBLIC reference docs, with real blast radius = developers coding around a non-existent constraint and expecting the wrong error code, does NOT clear as advisory) correctly predicted that a human would want it fixed before shipping. It was.

**Transferable rule:** For docs/tutorial PRs, a claim that is *checkable against the code and provably wrong* is a legitimate OPEN_GAP even when the primary bot review down-ranks or stops re-listing it, and even when it's "just docs." Do not round such claims down to advisory: public reference docs are an API contract surface, and maintainers do treat provably-false API claims as merge-blockers (evidence: this author corrected it across multiple review rounds before merging). When the only blocker is a code-contradicted doc claim and there's no verified red, ABSTAIN_POLICY:OPEN_GAP is the right disposition — it neither over-blocks (not BLOCK: no runtime defect) nor over-approves (the claim is real and wrong). Recall this on the next docs-accuracy PR: verify API claims against source; a provable contradiction is gap-worthy. Relates to [[approver-challenger-still-present-false-claim-live-gap]] and [[approver-challenger-devin-cross-platform-filename-false-positive]] (same PR chain).

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784014469307-approver-human-disagreement-validated-abstain-open.md`_
