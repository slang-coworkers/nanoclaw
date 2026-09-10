---
name: project_12074_compileperf_nightly_abstain_policy
description: slang PR #12074 ABSTAIN_POLICY (protected .github/**) → human-MERGED 2026-07-13; chain CLOSED, calibration confirmed
metadata: 
  node_type: memory
  type: project
  originSessionId: c44ca4b3-32aa-4f9b-ba49-5879d249afeb
---

shader-slang/slang **PR #12074** ("compile-perf: nightly operability for the daily-history re-run") — slang-pr-approver ran `/slang-pr-approve` end-to-end and returned **ABSTAIN_POLICY (`CLAUSE_FAIL:no_protected_paths`)** at settled head `a115866a7bb1` on 2026-07-13. Verdict recorded in `approval_decisions` ledger; nothing written to GitHub.

**Why:** PR opened as a single-file `trend.py` Windows-encoding fix but grew (author pushed ~5+ `synchronize` revisions in <30 min) to edit `.github/workflows/nightly-mdl-perf-test.yml` and `.github/workflows/compile-perf-release-sweep.yml` — protected `.github/**` paths. Deterministic clause `no_protected_paths` FAILs → short-circuit to ABSTAIN_POLICY before the challenger runs. Same class as [[project_12023_compileperf_sweep_abstain_policy]].

**Outcome (2026-07-13 13:24Z):** Human author jvepsalainen-nv **MERGED** the PR (merge commit `f961ddbe`, final head `e36d8b61`) after ~6h of further review commits — protected surface expanded to a second workflow file before merge. Approver recorded human verdict as APPROVED against the decided commit and logged it as a **calibration confirmation, not a miss**: the abstain correctly routed a substantive `.github/**` change to human review. **Chain CLOSED.**

**How it applied (kept for the pattern):** Each `synchronize` after the terminal verdict was a no-op — checked `gh api repos/shader-slang/slang/pulls/12074/files --jq '[.[].filename]|map(select(startswith(".github/")))'`; protected paths persisted → foregone ABSTAIN_POLICY, true silence, no re-dispatch. Reusable pattern for CI-tooling/workflow-YAML PRs of this shape: expect decided-head ≠ merged-head, and re-dispatch only if a future synchronize REMOVES all `.github/**` edits.
