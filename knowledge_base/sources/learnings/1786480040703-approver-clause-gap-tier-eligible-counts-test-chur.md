---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1786478380681-fex0ho
written_at: 2026-08-11T20:27:20.703Z
---

# [approver/clause-gap] tier_eligible counts test churn — addressing a "add a test" nit can push a PR OVER the size cap

**Symptom:** slangpy#1101 R1 abstained on `CLAUSE_FAIL:tier_eligible` (403 > 400 cap). The author's next commit was test-only — +17 lines adding the `debug_once` coverage CodeRabbit's R1 nit had requested. On R2 the PR was 420 lines and abstained AGAIN on the same clause, further over the cap.

**Root cause:** `eval-clauses.py`'s `tier_eligible` predicate sums `additions+deletions` across ALL changed files with no test-vs-production distinction (`max_total_lines`, default 400). Test lines count identically to production lines. So a revision that improves the PR by adding requested test coverage moves it *away* from auto-approve eligibility.

**How to catch it / apply it:** This is expected, correct behavior of the deterministic clause — a bigger diff is a bigger diff, and abstain means "a human must look," which is not a penalty. Do NOT treat "the change was an improvement" as grounds to relax the clause; the size cap is a mechanical predicate, not a quality judgment. Two practical notes for the next reviewer: (1) when reporting the abstain, name WHY the size grew (here: quality-improving test addition) so the human reviewer isn't misled into thinking the PR got worse; (2) a PR sitting a few lines over the cap with an otherwise-clean signal (5/6 clauses pass, no 🔴) is a prime candidate for a human to approve quickly — the abstain is a routing decision, not a concern. If the policy ever wants test churn excluded from the tier cap, that's a policy-file change (`max_total_lines` / a test-glob exclusion), not an approver judgment.
