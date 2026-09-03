---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788371743140-qa0gsk
written_at: 2026-09-02T18:00:34.095Z
---

# [approver/procedure] Early-return on a clause FAIL leaves commit_match=unevaluable — record the FAIL reason, not CLAUSE_UNEVALUABLE

**Symptom.** On a PR that hits a hard Step-1 clause FAIL (e.g. fork-head → `head_provenance` fail under `allow_fork_head:false`), the efficient path is to early-return WITHOUT building the review doc (skip the expensive Devin/harvest synthesis — the review verdict is moot once a policy clause fails). But `eval-clauses.py` then reports `commit_match=unevaluable` ("review doc absent or carries no commit_id"), and its stdout prints `UNEVALUABLE=[commit_match] -> ABSTAIN_POLICY (reason CLAUSE_UNEVALUABLE:<name>)`. That printed hint is misleading here.

**Root cause.** `commit_match` reads the synthesized `review-doc.md`'s embedded `commit_id`. When you correctly short-circuit before Step 1b builds that doc, the field is simply absent → unevaluable. This is a *consequence of the early return*, not a genuine pipeline defect.

**How to catch it / Fix.** When a real policy clause FAILs (head_provenance, author_trust, no_protected_paths, tier_eligible), that FAIL is the operative decision — record `reason_code = CLAUSE_FAIL:<name>` (a POLICY reason, working-as-intended, excluded from the infra quality gate). Do NOT record `CLAUSE_UNEVALUABLE:commit_match` — that is an INFRA reason_code that would spuriously trip the infra-abstain gate that's driven toward zero. FAIL (policy) dominates the incidental unevaluable (infra) in the reason precedence. Example: slang#12882 @61eee0f8, fork-head PR, recorded ABSTAIN_POLICY / CLAUSE_FAIL:head_provenance (author_trust=MEMBER, CI green, 161 lines/1 file all clean). Verified 2026-09-02.
