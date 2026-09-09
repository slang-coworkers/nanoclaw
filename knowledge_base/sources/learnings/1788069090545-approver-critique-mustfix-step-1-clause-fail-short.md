---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788065699290-u7npmh
written_at: 2026-08-30T05:51:30.545Z
---

# [approver/critique-mustfix] Step-1 clause FAIL short-circuits to ABSTAIN before the challenger — a verified 🔴 does not become BLOCK when CI is already red

**PR:** shader-slang/slang#12830. I derived BLOCK/RED_BUG from a verified challenger 🔴, and the DECISION_REVIEW critique correctly issued must-fix → recorded decision corrected to ABSTAIN_POLICY (CLAUSE_FAIL:ci_green_on_sha).

**The procedure ordering I violated.** The slang-pr-approver skill is a strict pipeline:
- Step 1 (eligibility clauses): ANY clause FAIL ⇒ ABSTAIN_POLICY (reason CLAUSE_FAIL:<name>) with an **early return**.
- Step 2 (verdict parse): any review-doc 🔴 ⇒ BLOCK.
- Step 3 (challenger): "runs ONLY if Steps 1–2 pass."

So when `ci_green_on_sha` FAILS at Step 1, the procedure settles at ABSTAIN **before** the challenger runs. The challenger's 🔴 cannot promote the decision to BLOCK — the challenger never legitimately executes on that path. And BLOCK (Step 2) requires a 🔴 in the REVIEW DOC; here the primary bot verdict was 🟡 (0 bugs), so there was no Step-2 BLOCK either. The 🔴 was mine (challenger), which is gated off.

**Why this is correct, not a technicality.** BLOCK and WOULD_APPROVE both make a POSITIVE claim about the change and are critique-gated. ABSTAIN asserts nothing about the code — "a human must look." When CI is red you cannot certify the change either way; handing it to a human (with the verified finding attached as the reason CI is red) is the honest state. The finding is NOT lost — it rides along in the challenger field + investigation.md as "the reason ci_green_on_sha failed."

**How to catch it next time (transferable):** Before writing BLOCK/WOULD_APPROVE, re-read the clause summary. If ANY Step-1 clause failed, the decision is ABSTAIN_POLICY:CLAUSE_FAIL:<name> — full stop, early return, no critique gate — regardless of how strong a challenger finding you have. A red CI + a verified crash are the SAME underlying problem; record ABSTAIN and surface the crash to the human, don't try to upgrade to BLOCK. Also: ABSTAIN rows are NOT critique-gated — do not run OUTPUT_REVIEW for them; record_decision directly and send the [Approval Decision].

**Meta (also transferable):** the DECISION_REVIEW gate caught a *procedure* error, not a factual one — my facts were right, my decision-STATE mapping was out of order. The critique gate earns its keep on procedure conformance, not just fact-checking.
