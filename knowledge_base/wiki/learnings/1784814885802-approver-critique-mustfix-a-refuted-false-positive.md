---
title: "[approver/critique-mustfix] A refuted/false-positive bot-🔴 lands at ABSTAIN_POLICY, not BLOCK — Step 4's 'verified' qualifier governs, not Step 2's mechanical map"
type: learning
topic: review-approval
source: learnings/1784814885802-approver-critique-mustfix-a-refuted-false-positive.md
---

# [approver/critique-mustfix] A refuted/false-positive bot-🔴 lands at ABSTAIN_POLICY, not BLOCK — Step 4's "verified" qualifier governs, not Step 2's mechanical map

**Symptom:** On slang-rhi#800 R2, the codex DECISION_REVIEW gate repeatedly returned must-fix demanding "record BLOCK, not ABSTAIN_POLICY" — quoting the skill's Step 2 "any 🔴 Bug => BLOCK" and "challenger runs only if Step 2 passes." One fresh codex thread held this line even after another thread had conceded. Took 8 critique rounds across two threads to settle. The mechanical reading would have forced a **false-BLOCK** on a CI-green, CodeRabbit-clean, textbook-correct change whose lone 🔴 was a provable false positive.

**Root cause:** Step 2's "🔴 => BLOCK" is read in isolation as a hard terminal, ignoring two other clauses of the SAME procedure that only make sense if a doc-🔴 reaches the challenger:
- **Step 4 defines BLOCK with an explicit qualifier:** "BLOCK — the review found a **VERIFIED** 🔴 Bug." The word *verified* is load-bearing. If Step 2 were the final unchallengeable outcome for any 🔴, "verified" would be meaningless.
- **Step 3 explicitly presupposes 🔴 cases are inside the challenger:** "investigation can only add caution, never **upgrade a doc's 🔴 toward approval**." That guardrail can only fire if the challenger IS evaluating 🔴 docs. And Step 3's opener: the doc is "your **prior, not your verdict**… reconcile with the doc (agree / **disagree** / extend)."

**The coherent reading (procedure of record):** Step 2's "🔴 => BLOCK" sets the doc's PRIOR (BLOCK-shaped). Step 3 is where the approver verifies it. The bar is asymmetric: a refuted 🔴 may NOT be rounded UP to WOULD_APPROVE, but it is NOT auto-BLOCK either. **BLOCK is reserved for a VERIFIED, reachable 🔴; a refuted/false-positive bot-🔴 lands at ABSTAIN_POLICY (reason_code CHALLENGER_CONCERN or, if an independent verified gap exists, that gap carries it).** "Decisions are joined against human outcomes; accuracy is measured" — a false-BLOCK is exactly the miscalibration that punishes.

**How to catch it / how to defend it at the gate:** When codex DECISION_REVIEW demands BLOCK on a refuted 🔴, cite SKILL.md:75-78 (prior-not-verdict / disagree), 112-114 (never-upgrade-🔴, which presupposes 🔴 in Step 3), 126-127 (BLOCK = *verified* 🔴), and 204-205 (accuracy measured / false-block punished) TOGETHER — not Step 2 alone. Point to ledger precedent: this same 🔴 at R1 (work/800-66846d6959bd) and PR 12095 both recorded CHALLENGER_CONCERN, not BLOCK. The reviewer will converge once it reads the whole procedure. Contrast: BLOCK IS correct for a VERIFIED reachable 🔴 (PR 12147 RELEASE_ASSERT reachable via multi-target; PR 11471 verified ×2).

**Fix (procedure sharpening):** Keep an explicit "Why ABSTAIN and not BLOCK" reconciliation section in investigation.md whenever the doc carries a 🔴 you refute — it pre-empts the gate loop and documents the verified-vs-refuted distinction for the join. Recurring gate friction on this exact point suggests the skill's Step 2 could state inline that "🔴 => BLOCK" is the doc's prior verdict subject to Step 3 verification, with BLOCK final only for a verified 🔴.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784814885802-approver-critique-mustfix-a-refuted-false-positive.md`_
