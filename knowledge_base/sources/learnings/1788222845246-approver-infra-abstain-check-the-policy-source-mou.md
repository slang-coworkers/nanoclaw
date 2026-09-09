---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787680030974-lt372z
written_at: 2026-09-01T00:34:05.246Z
---

# [approver/infra-abstain] Check the policy SOURCE (mounted overlay vs bundled default), not just the version string — a dropped overlay silently tightens clauses and flips decisions between revisions

**Symptom:** slang#12378 R1 (@23307e75) evaluated under policy `v0-shadow-wide` (CONTRIBUTOR trusted, higher line cap) — clauses passed. R2 (@e871b30c, a synchronize) evaluated under `v0-shadow` — `author_trust` and `tier_eligible` FAILed for the *same* bot author and near-identical size, forcing ABSTAIN_POLICY / CLAUSE_FAIL. The PR barely changed (comment-only +5 lines); the decision flipped because the *policy* changed underneath.

**Root cause:** `eval-clauses.py` resolves the policy in order: `--policy` → per-PR `<ws>/policy/APPROVAL_POLICY.json` → group overlay `/workspace/extra/approver-policy/APPROVAL_POLICY.json` → bundled default `scripts/APPROVAL_POLICY.json`. The group overlay is a RELAXATION layer (`v0-shadow-wide`: trusts CONTRIBUTOR, raises caps). Between R1 and R2 that overlay file **disappeared** (the dir went empty), so resolution fell through to the conservative bundled default `v0-shadow` (trusted=[OWNER,MEMBER,COLLABORATOR], cap 400). The fallback is by-design safe (no overlay ⇒ conservative ⇒ hand to a human), so it is a legitimate CLAUSE_FAIL (policy family), NOT a CLAUSE_UNEVALUABLE/infra abstain — the clauses were fully evaluable and definitively failed.

**How to catch it:** When a decision's clause outcome differs from a prior revision of the same PR, don't attribute it to the PR — first diff the POLICY. Confirm which of the 4 resolution paths won (does the group overlay file actually exist? `ls -la /workspace/extra/approver-policy/`), and record the resolved `policy_version` AND its source path in the decision, not just the version. A silently-missing mount reads as a normal conservative decision unless you look.

**Fix / report:** Record the ABSTAIN as CLAUSE_FAIL (correct — policy is working as its safe default), but FLAG the overlay disappearance to the operator as possibly-unintended config drift, because it materially changed the regime for every PR this session, not just this one. Ask whether the tightening is deliberate before assuming the conservative default is the intended policy.
