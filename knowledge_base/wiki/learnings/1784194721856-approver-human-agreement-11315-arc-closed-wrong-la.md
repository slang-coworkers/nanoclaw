---
title: "[approver/human-agreement] #11315 arc CLOSED: wrong-layer drop (#11323, I abstained, CHANGES_REQUESTED) → correct-layer producer fix (#12117, I approved, MERGED byte-identical + human APPROVED) — the producer-fix redo of a rejected symptom-patch is a strong clean-approve prior"
type: learning
topic: review-approval
source: learnings/1784194721856-approver-human-agreement-11315-arc-closed-wrong-la.md
---

# [approver/human-agreement] #11315 arc CLOSED: wrong-layer drop (#11323, I abstained, CHANGES_REQUESTED) → correct-layer producer fix (#12117, I approved, MERGED byte-identical + human APPROVED) — the producer-fix redo of a rejected symptom-patch is a strong clean-approve prior

**Confirmed-safe / agreement (both revisions matched the human outcome).** #12117 "lower `(void)expr` to canonical void value" (skiminki-nv) MERGED 2026-07-16 @ merge commit 8e8653f8, PR head 5918fba3 = my **R2 decision head byte-identical, zero follow-up commits**; a human COLLABORATOR (jvepsalainen-nv) explicitly APPROVED @07:31Z before the author merged. My R2 WOULD_APPROVE (CLEAN) = clean agreement; R1 @47deb4ef stamped SUPERSEDED_BY_LATER_REVISION (its content was carried forward + hardened into R2, which merged).

**The arc that closed (the calibration payoff):**
- #11323 (bot fixer, "drop kIROp_CastToVoid before emit") — I held **ABSTAIN_POLICY (CHALLENGER_CONCERN)**; skiminki-nv CLOSED-UNMERGED it "wrong fix — never produce CastToVoid in the first place." human_verdict=CHANGES_REQUESTED = vindicated HOLD.
- #12117 (same maintainer, the producer-side redo my #11323 post-mortem predicted) — I held **WOULD_APPROVE (CLEAN)** across R1+R2; MERGED byte-identical + human APPROVED = vindicated APPROVE.

**Transferable prior for Step-0 recall:** when a PR is the *producer-side redo of a symptom-patch the maintainer already rejected as wrong-layer* (drop/guard/patch-downstream → fix-the-producer), and the fix removes the redundant representation at its source, that is the sanctioned direction and a strong clean-approve prior — PROVIDED you verify (the R1 confirmed-safe checklist): op no longer materialized at ALL producer sites, enum retained only for a non-IR (front-end intrinsic) role, canonical value used, index/table shrink bounds-safe, the invariant the op enforced preserved elsewhere, side effects preserved.

**Second transferable prior (revision chains):** a synchronize whose commits address *exactly the prior review's own gaps without touching the fix core* is a strong prior for a clean re-verdict. #12117 R2's 2 commits resolved all 3 of R1's 🟡 gaps + the formatting red (bounds asserts, SLANG_ASSERT→RELEASE_ASSERT, `-cpu` side-effect test, opMap row collapse) — the fresh primary review dropped 3 gaps→2, 0 bugs throughout, and it merged. Still run the FULL fresh procedure per revision, but expect the delta to *improve* on an already-CLEAN head, and re-verify the core invariants from source at the new head (they were, all 6 held).

**Also confirmed:** the join-verification discipline paid off THIS PR — a spurious "MERGED @b8f1c2a0" join (11:17Z, SHA didn't exist, PR was OPEN) was correctly refused; the REAL merge join (next day, state=MERGED, mergeCommit resolves, head=my decision SHA) was stamped. Verify every join against live GitHub before record_human_verdict. See [[pr-11323-decided]].

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784194721856-approver-human-agreement-11315-arc-closed-wrong-la.md`_
