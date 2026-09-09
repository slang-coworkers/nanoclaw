---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787912398061-vtojnx
written_at: 2026-08-31T18:10:41.834Z
---

# [approver/clause-gap] Empty policy/ mount → bundled-default fallback can silently change a decision across revisions

**Symptom.** Same PR (slang #12795), two `synchronize` re-evals days apart. Aug 28 (head 6c50a9a): eval-clauses ran under `v0-shadow-wide`, `author_trust` (CONTRIBUTOR) and `tier_eligible` (1124 lines) both PASSED — the decision turned on review-freshness (ABSTAIN NO_REVIEW_SIGNAL). Aug 31 (head 39e4a7e): eval-clauses ran under `v0-shadow` and BOTH clauses now FAIL (CONTRIBUTOR not in `[COLLABORATOR,MEMBER,OWNER]`; 1124 > 400 cap) → ABSTAIN CLAUSE_FAIL. The code was clean and a human had APPROVED, but the eligibility gate (Step 1, authoritative) early-returned to abstain.

**Root cause.** The mounted `policy/` directory was **empty**, so `eval-clauses.py` used its **designed fallback** to the bundled `scripts/APPROVAL_POLICY.json` — which is `v0-shadow` (stricter than the `v0-shadow-wide` that was effective earlier). Empty-mount → bundled-default is documented, expected behavior, NOT an infra failure. But it means the *effective* policy can change between revisions of the same PR without any explicit operator action visible to the approver, flipping a would-be WOULD_APPROVE into an eligibility abstain.

**How to catch it.** (1) Always read `clauses.json.policy_version` and don't assume it's stable across a revision chain — the skill already says re-run clauses fresh per revision, and this is *why*. (2) When a re-eval of a PR you previously handled changes decision family, diff the `policy_version` between the two rows before attributing the change to the PR. (3) If the mounted `policy/` is empty when you expected a specific version, surface it as an observation — don't override the clauses (the fallback is authoritative), but flag whether the empty mount is intentional.

**Fix / transferable rule.** A Step-1 clause FAIL is authoritative and early-returns to ABSTAIN_POLICY(CLAUSE_FAIL) *regardless* of clean code, a clean challenger, or an existing human approval — never round a clause-fail up to WOULD_APPROVE because "the code is obviously fine." Report the clause-fail as the decision AND separately surface any suspected policy-mount drift (version changed vs. a prior row, empty mount) to the operator so they can confirm the intended policy. CLAUSE_FAIL is a *policy* abstain (system working as intended), distinct from the infra reason_codes — do not conflate the two.
