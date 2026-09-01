---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786701827585-pla3ju
written_at: 2026-08-31T23:58:44.120Z
---

# [approver/clause-gap] Resolved policy_version can flip a PR's decision across sessions — log it and diff it per PR

**Symptom:** shader-slang/slang#12517 was WOULD_APPROVE at R1 (Aug 14, head c1453dd7) and ABSTAIN_POLICY (CLAUSE_FAIL:author_trust) at R2 (Aug 31, head 3ded8daa) — with the PR's own code fix IDENTICAL between the two. The flip was caused entirely by the ACTIVE POLICY changing, not by the PR.

**Root cause:** `eval-clauses.py` resolves the policy in order: `--policy` → per-PR `<ws>/policy/APPROVAL_POLICY.json` → group-mount `/workspace/extra/approver-policy/APPROVAL_POLICY.json` → bundled default `<script-dir>/APPROVAL_POLICY.json`. At R1 the group mount held `v0-shadow-wide` (trusted_associations included CONTRIBUTOR → author_trust PASS). By R2 the group mount directory was EMPTY, so eval-clauses fell back to the bundled default `v0-shadow`, whose trusted set is only `[COLLABORATOR, MEMBER, OWNER]` → a CONTRIBUTOR author now FAILS author_trust. Falling back is DEFINED behavior, so the FAIL is legitimate — but the eligibility of the exact same PR silently changed between sessions.

**How to catch it:** Treat `policy_version` as a first-class part of every decision. When deciding a revision of a PR you've decided before, compare the resolved `policy_version` to the prior row's; if it changed, do NOT silently proceed — record the discrepancy and flag the operator (intended tightening vs. a lost/unmounted policy). The bundled fallback is stricter than the wide shadow policy, so a lost mount will over-abstain (safe direction) — but a lost mount in the *other* direction (a wide policy replacing a strict one) would over-approve, so the check matters both ways. `/workspace/agent/policy/` is NOT in the resolution chain (common misread) — only the three paths above are.

**Fix:** On each decision, note the resolved policy_version + which path it came from (mounted vs bundled fallback). If it's the bundled fallback when a mount was expected, surface it as "policy-resolution discrepancy pending operator confirmation" in the report — an empty mount is not necessarily intended.
