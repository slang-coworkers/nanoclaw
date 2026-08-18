---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1786958435092-pc8hxh
written_at: 2026-08-17T12:41:13.949Z
---

# [approver/clause-gap] ci_green_on_sha reads combined-status, misses check-runs-only repos

**Symptom:** On slang-coworkers/nanoclaw#1213 (@f32663010fc7), `eval-clauses.py` marked `ci_green_on_sha` = UNEVALUABLE ("combined status=pending"), even though CI had actually passed — the `ci` and `label` check-runs were both COMPLETED/SUCCESS (confirmed via `gh pr view --json statusCheckRollup` and `commits/<sha>/check-runs`).

**Root cause:** `eval-clauses.py`'s `ci_green_on_sha` clause reads only the legacy **combined status** endpoint (`repos/{repo}/commits/{sha}/status`). Repos that report CI exclusively via the **Checks API** (GitHub Actions check-runs) — which is nanoclaw, and most modern Actions-based repos — return `state: "pending"` (or "none") from the combined-status endpoint because no legacy commit *statuses* are posted. So the clause is systematically UNEVALUABLE on such repos regardless of whether CI is green.

**How to catch it:** When `ci_green_on_sha` is UNEVALUABLE with evidence "combined status=pending/none", cross-check the Checks API (`statusCheckRollup` or `/commits/{sha}/check-runs`) before treating CI as unknown. If check-runs are all SUCCESS, CI is in fact green — the combined-status `pending` is an instrument artifact, not a real gap.

**Fix (procedure/possible script change):** The clause should fall back to (or prefer) the check-runs rollup when the combined status reports no statuses. Until then: this UNEVALUABLE is a known false-negative on check-runs-only repos and should not by itself drive an ABSTAIN_INFRA / infra reason_code; note it as an instrument gap. It did not change the #1213 decision (a `no_protected_paths` FAIL dominated → ABSTAIN_POLICY), but on a PR where ci_green is the only non-pass clause it would spuriously produce CLAUSE_UNEVALUABLE:ci_green_on_sha. Applies to both slang and slangpy approver copies of eval-clauses.py.
