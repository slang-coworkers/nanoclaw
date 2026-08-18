---
title: "[approver/confirmed-safe] Trivial-fwd-derivative zeroed-primal fix (#11670) merged APPROVED at my exact decision head — 3-way agreement, repeated master-merges were safe re-decides"
type: learning
topic: review-approval
source: learnings/1784066119880-approver-confirmed-safe-trivial-fwd-derivative-zer.md
---

# [approver/confirmed-safe] Trivial-fwd-derivative zeroed-primal fix (#11670) merged APPROVED at my exact decision head — 3-way agreement, repeated master-merges were safe re-decides

**Outcome:** slang PR #11670 ("Fix zeroed primal in synthesized trivial forward derivative", generateTrivialFwdDiffFunc) MERGED 2026-07-14T21:54:03Z by saipraveenb25 (COLLABORATOR), reviewDecision APPROVED, merge commit e28b5e9c. The merged head was 19402c70 — EXACTLY my last WOULD_APPROVE decision head, zero follow-up commits. All 3 of my ledger rows (49825f56, 57a7e0, 19402c70) recorded APPROVED human verdicts. Clean 3-way agreement; not a false-safe.

**What was safe, and why (transferable):**
1. **The dzero-emission fix pattern.** The PR's crux was replacing `emitDefaultConstructRaw` with `getDifferentialZeroOfType` for the trivial-fwd inout/out tangent, plus a CustomZeroFloat dzero()=42 regression test. My rev2 (49825f56) WOULD_APPROVE on that fix held all the way to merge — confirming the [approver/clause-gap] dzero probe learning: once both emit sites use getDifferentialZeroOfType AND a custom-dzero test proves the additive-identity path, the fix is complete and mergeable. Maintainer agreed.

2. **Repeated master-merges with byte-identical PR contribution are safe trivial re-decides.** #11670 went through 3 heads after the fix (49825f56 → 57a7e0 → 19402c70), the last two being pure master-merges (by reviewer, then author) that left the PR's own 2 files byte-identical (diff_hash 057dc493c8bd stable across all). Each re-decide was WOULD_APPROVE and merge confirmed all three. Lesson: when a synchronize is a master-merge and `gh api compare <prev>...<new>` restricted to the PR's own files returns [], the re-decide rides the prior verdict UNLESS the merged-in master touches the PR's specific code path.

3. **The elevated merge-in check paid off but found no risk.** rev4's merge pulled in autodiff master (CoopVec subscripts #12031). I checked instead of assuming: the CoopVec work was in slang-ir-autodiff-REV.cpp (backward) + slang-check-*, disjoint from this PR's slang-ir-autodiff-FWD.cpp forward path (merge delta had zero ref to generateTrivialFwdDiffFunc/emitInOutParamWriteBacks/TrivialForwardDifferentiate/TreatAsDifferentiable). Merge confirmed no interaction. Rule: "merged-in master touches the same broad area (autodiff)" is NOT automatically a risk — verify mode (fwd vs rev) and call-graph overlap; disjoint sub-systems within a shared directory don't interact.

**Process wins that held up:** (a) the DECISION_REVIEW critique gate caught TWO real defects mid-session — a dropped Devin flag (b7686cb) and a Devin-only-vs-primary timing race (57a7e0) — both of which, uncorrected, could have flipped or mis-tiered a decision; (b) polling the in_progress production `review` check + re-harvesting before recording secured the primary tier on 2 revisions instead of settling for Devin-only. These are the [approver/infra-abstain] timing-race + extraction-miss learnings in action.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784066119880-approver-confirmed-safe-trivial-fwd-derivative-zer.md`_
