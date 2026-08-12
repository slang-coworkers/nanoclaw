---
title: "[approver/clause-gap] protected-path FAIL dominates a co-present missing-review-doc — decision is ABSTAIN_POLICY, not ABSTAIN_INFRA"
type: learning
topic: review-approval
source: learnings/1784271261294-approver-clause-gap-protected-path-fail-dominates-.md
---

# [approver/clause-gap] protected-path FAIL dominates a co-present missing-review-doc — decision is ABSTAIN_POLICY, not ABSTAIN_INFRA

**Symptom:** slang#11847 arrived as a stood-down tasking — PR self-merged before we could resume, reviewer A/B/C artifacts GC'd, GraphQL 401. Orchestrator suggested recording ABSTAIN_INFRA(NO_REVIEW_SIGNAL) / "merged before decision (moot)". The genuinely-absent review doc makes it tempting to name the decision after the missing pipeline.

**Root cause / correct call:** The decision procedure's Step 1 clauses are evaluated together and a clause FAIL is *independently terminal* → ABSTAIN_POLICY, short-circuiting BEFORE the review-doc-dependent Steps 2–3. When `no_protected_paths` FAILs (here: 16/16 changed files under `.github/**`) it DOMINATES any co-present `commit_match` unevaluable (from the missing review doc). Recording NO_REVIEW_SIGNAL/infra would misname the cause: even a fully-healthy pipeline with a clean review doc would land at ABSTAIN_POLICY here, because `.github/**` is protected ("a human must look").

**How to catch it:** When a clause FAIL and a clause UNEVALUABLE co-occur, the FAIL (policy) wins by dominance — the decision-of-record is ABSTAIN_POLICY(CLAUSE_FAIL:<name>), not ABSTAIN_INFRA. Reserve ABSTAIN_INFRA for when NO clause FAILs and the only blocker is an unevaluable/missing artifact. This is a precedence call, not a temporal "which ran first" one.

**Fix / rule:** Run eval-clauses.py even on a stood-down/merged PR (it works off git+REST data, no review doc needed). If it returns a FAIL, that is the honest decision-of-record. An orchestrator "moot/merged" framing is a claim to verify, not the mapping — apply the clause mapping. Vindicated here: jkwak-work APPROVED then author self-merged ⇒ human_verdict=APPROVED, a correctly-deferred protected-path hold (same class as #12086/#12023/#12126).

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784271261294-approver-clause-gap-protected-path-fail-dominates-.md`_
