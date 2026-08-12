---
title: "[approver/critique-mustfix] fallback-tier heuristic red-flag: Step-2 BLOCK requires Step-4 VERIFIED, else ABSTAIN not BLOCK"
type: learning
topic: review-approval
source: learnings/1784080988551-approver-critique-mustfix-fallback-tier-heuristic-.md
---

# [approver/critique-mustfix] fallback-tier heuristic red-flag: Step-2 BLOCK requires Step-4 VERIFIED, else ABSTAIN not BLOCK

**Symptom.** On a Devin-only fallback-tier PR (harvest exit 20, bot-authored fixer branch — no github-actions[bot] production review, no CodeRabbit), Devin reported one "Bug" under `## Bugs`. The synthesized review doc honestly recorded `verdict: REQUEST_CHANGES, bugs: 1`. The DECISION_REVIEW critique gate, reading skill Step 2 literally ("any 🔴 Bug => BLOCK; Step 3 runs only if Steps 1–2 pass"), first returned **must-fix demanding BLOCK**. (slang#11323 @ ed53107b56, `eliminateCastToVoid` pass — Devin flagged unconditional `removeAndDeallocate` of `kIROp_CastToVoid` without a use-check.)

**Root cause.** Step 2's "any 🔴 Bug => BLOCK" and Step 4's enum definition ("BLOCK — the review found a **VERIFIED** 🔴 Bug") are in tension, and Step 3's fallback-tier note resolves it: *"a fallback verdict you're unsure of ROUTES HERE [Step 3], and uncertainty => ABSTAIN, never rounds up."* So the correct reading is:
- **Primary tier** (`github-actions[bot]`) 🔴 = high-confidence verified marker → BLOCK at Step 2.
- **Fallback tier** (Devin/CodeRabbit) heuristic 🔴 (e.g. Devin "Repo rule" static flags) → routed to Step 3, becomes BLOCK **only if the challenger VERIFIES it**; if the challenger REFUTES it, it is not a verified 🔴 → not BLOCK; and "never upgrade a doc's 🔴 toward approval" bars WOULD_APPROVE → terminal = **ABSTAIN_POLICY / CHALLENGER_CONCERN**.

**How to catch it.** When the critique pushes toward BLOCK on a fallback-tier finding, ask: *would recording BLOCK/RED_BUG assert to the ledger that a VERIFIED red bug exists?* If the challenger refuted the finding, that assertion is materially false and would near-certainly disagree with the human outcome. Reply to the critique on-thread with Step-4's "verified" qualifier + Step-3's fallback-routing text quoted verbatim; codex retracted the BLOCK demand and approved ABSTAIN once both were weighted.

**Fix.** Fallback-tier heuristic 🔴 that the challenger conclusively refutes ⇒ ABSTAIN_POLICY (CHALLENGER_CONCERN), never BLOCK (not verified) and never WOULD_APPROVE (can't upgrade a doc 🔴). BLOCK is reserved for a challenger-VERIFIED red bug or a primary-tier 🔴. This is the recurring reconciliation for the entire bot-authored-fixer-PR class where Devin's static rules (removeAndDeallocate/raw-pointer patterns) fire routinely.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784080988551-approver-critique-mustfix-fallback-tier-heuristic-.md`_
