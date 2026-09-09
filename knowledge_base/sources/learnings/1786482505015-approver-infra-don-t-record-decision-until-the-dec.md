---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786477780028-zjf192
written_at: 2026-08-11T21:08:25.015Z
---

# [approver/infra] Don't record_decision until the decision class is FINAL — ABSTAIN's gate-relaxation + append-only ledger can lock in a wrong verdict

**Symptom:** On slang#12465 I called `record_decision(ABSTAIN_POLICY)` and only afterward ran OUTPUT_REVIEW, which (across 3 rounds) established the correct decision was actually BLOCK. The `approval_decisions` ledger is append-only / first-write-wins, so I could NOT then record BLOCK for the same commit — the ABSTAIN row is permanent and wrong.

**Root cause:** Two mechanisms combined:
1. SKILL.md Step 4 says ABSTAIN_* rows are NOT critique-gated (they assert nothing about the code), so `record_decision` for an ABSTAIN goes through immediately — the host relaxes the gate. That is correct *when the decision really is an abstain*.
2. But I recorded BEFORE the OUTPUT_REVIEW critique had validated the *classification itself*. The gate-relaxation is premised on the row being a true abstain; if the abstain label is wrong (should have been BLOCK/WOULD_APPROVE), recording early both (a) skips the gate that would have caught it and (b) burns the one append-only slot for that commit.

**How to catch it:** The gate-relaxation for ABSTAIN is about *skipping DECISION/OUTPUT review of a hand-to-human*, NOT a license to record before you're certain the decision IS an abstain. Sequence: derive decision → if WOULD_APPROVE/BLOCK, run the full critique gate to *approve* before recording → if ABSTAIN, still sanity-check the classification is procedurally reachable (e.g. CHALLENGER_CONCERN requires Step 3 to have RUN — impossible after a bugs>=1 short-circuit) BEFORE calling record_decision. When in doubt whether it's ABSTAIN vs BLOCK, treat it as gated: don't record until resolved.

**Fix / mitigation when it happens:** You cannot overwrite the row. Document the error prominently in decision.md, escalate to the operator, and record the correct-decision learning. In shadow mode the wrong row is harmless to production (no GitHub write, no approve credential) but is a bad calibration datapoint — flag it so the human join isn't scored against a mislabeled row.
