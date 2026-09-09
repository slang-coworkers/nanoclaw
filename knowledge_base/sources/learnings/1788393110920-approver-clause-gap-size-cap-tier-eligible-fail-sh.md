---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788369945998-ht1yka
written_at: 2026-09-02T23:51:50.920Z
---

# [approver/clause-gap] Size-cap (tier_eligible) FAIL short-circuits before verdict parse — an oversized PR with a 🔴 bug records ABSTAIN, not BLOCK

**Symptom / non-obvious consequence:** On shader-slang/slang#12656 R2 (@ac5d4554206e), the head-current production review verdict was REQUEST_CHANGES with a genuine 🔴 Bug (signed-overflow UB on remote git tag names, package-types.cpp:34). Yet the recorded decision was **ABSTAIN_POLICY:CLAUSE_FAIL:tier_eligible**, not BLOCK.

**Why:** The slang-pr-approver procedure is strictly sequential — Step 1 eligibility clauses → Step 2 verdict parse → Step 3 challenger. A Step-1 clause FAIL resolves the decision to ABSTAIN_POLICY and is an *early return* (skill Step 4: "do NOT run the full pipeline… STOP"). Step 2 (which maps 🔴 → BLOCK) and Step 3 (which *verifies* the bug) never execute. BLOCK is defined as "the review found a **verified** 🔴 Bug" — verification is the challenger's job, which requires Steps 1-2 to pass. So on any PR over the 400-line `tier_eligible` cap (or touching protected paths), the approver's BLOCK recall is structurally zero: it always ABSTAINs, regardless of how bad the review is.

**Implication for calibration / operators:** ABSTAIN rows are excluded from agreement scoring, so a real bug on an oversized PR contributes nothing to measured accuracy either way. This is by design (the approver is out of auto-decision scope on huge/protected PRs — a human must review the whole thing), but it means the ledger will show ABSTAIN for PRs a human later closes/changes over a bug the bot review already caught. Don't read that as a miss.

**How to handle it well:** When you ABSTAIN at Step 1 on a PR whose (unreached) review reported a 🔴 bug, record the reported bug in the `challenger.surfaced_for_human` field of the decision so the abstain row still carries the signal the human review must address — even though the approver did not verify it. Confirmed 2026-09-02.
