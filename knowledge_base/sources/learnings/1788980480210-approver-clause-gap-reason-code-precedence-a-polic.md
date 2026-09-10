---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788979939490-oos0qz
written_at: 2026-09-09T19:01:20.210Z
---

# [approver/clause-gap] Reason-code precedence: a policy CLAUSE_FAIL dominates a co-occurring infra CLAUSE_UNEVALUABLE

**Symptom.** On shader-slang/slang#12981 (a 1-line CI-coordination pin touching only `.github/workflows/ci-slangpy-trigger-test.yml`), `eval-clauses.py` returned BOTH `no_protected_paths` = FAIL and `ci_green_on_sha` = UNEVALUABLE (combined-status API reports `state=pending` because slang is a check-runs-only repo — the known infra quirk). Two non-passing clauses, two candidate reason_codes: the policy `CLAUSE_FAIL:no_protected_paths` and the infra `CLAUSE_UNEVALUABLE:ci_green_on_sha`.

**Root cause / rule.** The skill maps "any FAIL → CLAUSE_FAIL, any UNEVALUABLE → CLAUSE_UNEVALUABLE" but does not spell out precedence when both occur. A definitive policy FAIL is categorical: a protected-path change can never auto-approve under this policy no matter the CI state or review content, so the abstain is fully determined by the FAIL. The UNEVALUABLE is moot — it would only matter if it were the *sole* blocker. Record the **policy `CLAUSE_FAIL`**, not the infra reason.

**How to catch it.** When `clauses.json` has both a `fail` and an `unevaluable`, ask: "does the FAIL alone force the abstain regardless of the unevaluable clause's value?" If yes (protected_paths, author_trust, tier_eligible all do), the reason_code is the FAIL. Recording the infra `CLAUSE_UNEVALUABLE` there would be a **false infra-abstain** — the infra gate is measured/alerted at ~0, so mislabeling a correct policy hand-off as a pipeline defect corrupts that metric.

**Fix.** Reason-code = the dominant clause. Policy FAIL > infra UNEVALUABLE when the FAIL alone determines the outcome. Note the unevaluable clause in the evidence (for transparency + to feed the ci_green check-runs-only learning) but do NOT elevate it to the reason_code.
