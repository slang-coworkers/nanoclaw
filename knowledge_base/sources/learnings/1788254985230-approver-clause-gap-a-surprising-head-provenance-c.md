---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787357416293-3boe10
written_at: 2026-09-01T09:29:45.230Z
---

# [approver/clause-gap] A surprising head_provenance/clause FAIL can be a policy-source flip — check the effective policy provenance before recording

**Symptom:** On slang#12690, my Aug-22 decision (head d26c2844) had `head_provenance` PASS under policy `v0-shadow-wide` ("fork head allowed"). On Sep-1 (new head 548818765c74, a `synchronize`), `eval-clauses.py` reported `head_provenance` **FAIL** ("fork head kaizhangNV/slang, policy forbids") under policy `v0-shadow` — same fork PR, same author, opposite eligibility.

**Root cause:** The effective policy changed between runs, not the PR. `eval-clauses.py` resolves policy by precedence: `--policy` > per-PR `<ws>/policy/APPROVAL_POLICY.json` > group mount `/workspace/extra/approver-policy/APPROVAL_POLICY.json` > bundled default `<skilldir>/scripts/APPROVAL_POLICY.json`. The group mount dir existed but was **empty**, so it fell back to the bundled default, which had been updated (mtime Aug 31) to `v0-shadow` with `allow_fork_head: false`. So a fork-head PR that was auto-approvable under the wide policy became a deterministic CLAUSE_FAIL under the default.

**How to catch it:** When a Step-1 clause FAILs in a way that contradicts a prior decision on the same PR/author — especially `head_provenance`, `author_trust`, `tier_eligible`, which are pure policy predicates — read the effective policy source before recording. `cat /workspace/extra/approver-policy/APPROVAL_POLICY.json` (the mount) and the bundled `.../scripts/APPROVAL_POLICY.json`; compare `policy_version` + the specific flag (`allow_fork_head`) against the prior decision's `policy_version`. An empty/missing mount that silently falls to a stricter bundled default can be an unintended tightening or a dropped mount.

**Fix:** The CLAUSE_FAIL is still HONEST (the policy was present + coherent + evaluated cleanly → `CLAUSE_FAIL`, not `CLAUSE_UNEVALUABLE`/infra), so record `ABSTAIN_POLICY / CLAUSE_FAIL:head_provenance`. But ALSO escalate the provenance flip to the operator — record honestly AND alert, so a lost mount / unintended policy change doesn't hide behind a clean-looking policy abstain. The decision was robust either way here (a standing maintainer CHANGES_REQUESTED + a new SLANG_RELEASE_ASSERT robustness question independently pointed at abstain), but the recorded reason must be the deterministic Step-1 driver.

**Bonus (calibration):** the R1 abstain worked as intended — my prior OPEN_GAP (missing negative directed-subtype E38029 control) was CLOSED in R2 by `gh-12659-invalid-dependent-siblings.slang`, a DIAGNOSTIC_TEST pinning E38029 on both non-equality directed-subtype bounds. A well-targeted OPEN_GAP abstain drove a real test being added.
