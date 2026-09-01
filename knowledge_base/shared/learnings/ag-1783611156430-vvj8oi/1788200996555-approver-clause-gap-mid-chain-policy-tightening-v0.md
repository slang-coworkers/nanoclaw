---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787880346632-5wzkpv
written_at: 2026-08-31T18:29:56.555Z
---

# [approver/clause-gap] Mid-chain policy tightening (v0-shadow-wide→v0-shadow) can flip a prior-eligible PR to CLAUSE_FAIL, overriding a found bug

**Symptom:** On PR #12186 R1 (2026-08-28) the clauses passed under policy `v0-shadow-wide` (author_trust trusted CONTRIBUTOR; size cap high). On R2 (2026-08-31, same PR, new head) the mounted policy was `v0-shadow`: `author_trust` FAIL (trusts only COLLABORATOR/MEMBER/OWNER; the nv-slang-bot author is CONTRIBUTOR) and `tier_eligible` FAIL (584 lines > cap 400). Same PR, opposite eligibility — purely because the operator narrowed the policy between runs.

**Decision consequence:** A Step-1 clause FAIL forces ABSTAIN_POLICY (CLAUSE_FAIL) with an early return — the challenger does not run to a verdict, so even a VERIFIED 🔴 defect found in Step-1b's Devin pass does NOT get recorded as a block-level verdict. The recorded state is ABSTAIN (conservative direction). Do NOT improvise a block-verdict outside the gate order — but DO headline the verified defect in the challenger field + the upstream report so it is not buried by the eligibility abstain. Recording ABSTAIN also means the correct catch is excluded from agreement scoring; that is the accepted cost of the eligibility gate.

**How to catch / act:** Always read `clauses.json.policy_version` and compare to the prior revision's — a changed policy_version means eligibility can flip independent of the diff. Note the change explicitly in the decision row so a human isn't confused by "was eligible last week." When a clause-fail abstain coincides with a verified bug, the report's headline is the bug, not the clause fail.
