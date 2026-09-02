---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787679061103-lqxsh6
written_at: 2026-09-01T23:06:36.800Z
---

# [approver/infra-abstain] Group policy mount vanishing silently narrows to bundled v0-shadow — flips all fork PRs to CLAUSE_FAIL:head_provenance

## Symptom
PR #12752 R1 (2026-08-25) evaluated under policy `v0-shadow-wide` with `head_provenance` PASS ("fork head allowed"). The same PR's R2 (2026-09-01, synchronize) evaluated under `v0-shadow` with `head_provenance` FAIL ("fork head kaizhangNV/slang, policy forbids") → ABSTAIN_POLICY. Nothing about the fork changed; the POLICY changed underneath the decision.

## Root cause
`eval-clauses.py` resolves policy in order: `--policy` → per-PR `<ws>/policy/APPROVAL_POLICY.json` → group mount `/workspace/extra/approver-policy/APPROVAL_POLICY.json` → bundled `scripts/APPROVAL_POLICY.json` (v0-shadow). The group mount dir existed but was EMPTY (no APPROVAL_POLICY.json), so it silently fell back to the bundled default. The bundled `v0-shadow` sets `allow_fork_head: false` and `require_ci_green: true`; the (now-absent) mounted `v0-shadow-wide` had allowed fork heads. Because ~all external slang contributions come from forks, this flips essentially every fork PR to `CLAUSE_FAIL:head_provenance` — a whole-class behavior change from a missing file.

## How to catch it
On any decision, compare the resolved `policy_version` in `clauses.json` against the prior revision's (and against what you expect to be mounted). If it changed with no operator announcement — especially bundled `v0-shadow` when a widened mount was in effect before — treat it as a probable infra regression: `ls -la /workspace/extra/approver-policy/`. An empty mount dir + `policy_version=v0-shadow` = the widened mount was lost. The fallback-to-bundled is BY DESIGN (so the resulting clause FAIL is a legitimate policy abstain, reason `CLAUSE_FAIL:head_provenance`, NOT `CLAUSE_UNEVALUABLE`), but the *mount loss* is operationally important and must be surfaced to the operator, because it silently changes scope for a whole PR class.

## Fix
Record the abstain honestly against the active policy (CLAUSE_FAIL:head_provenance) AND report the R1→R2 policy discrepancy up so the operator can re-mount `v0-shadow-wide` if fork-head PRs are meant to be in scope. Do not editorialize the decision (evaluate against the resolved policy), but never let a silent policy-mount change pass unremarked.
