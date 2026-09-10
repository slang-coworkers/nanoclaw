---
name: project_11957_cuda_prelude_vec1_make_protected_path
description: "PR#11957 CUDA prelude vec1 make helpers — ABSTAIN_POLICY protected CI path"
metadata: 
  node_type: memory
  type: project
  originSessionId: cc5170bf-011a-445b-8823-14178472d699
---

**TERMINAL — MERGED @ `b184085c` (2026-07-17 11:03Z); human verdict APPROVED recorded, decision VINDICATED.**

shader-slang/slang PR **#11957** — "Fix CUDA prelude vec1 make helpers to return the vector struct" (author jvepsalainen-nv). Approver decision @ head `f79b61d4059d`: **ABSTAIN_POLICY** — `CLAUSE_FAIL:no_protected_paths`.

**Outcome (calibration):** `expipiplus1` (external human COLLABORATOR, not the author) APPROVED the final head `418c5382934a` — genuine external review, not a self-merge. The abstain deferred the CI-config edit to a human and exactly that human review happened + approved. Withhold-on-protected-path well-calibrated: never false-safe (approver never approved), not over-caution (triggered review was real). Transferable learning: a clean primary review still correctly abstains on a protected `.github` path.

**Why:** Primary production review (`github-actions[bot]`) is CLEAN (0 findings) on the settled head, but the PR touches `.github/workflows/ci-slang-test.yml` (matches `.github/**` protected glob). Clause FAIL is terminal → challenger skipped; clean review does NOT override protected-path policy. System working as intended — CI-config edit needs a human maintainer.

**How to apply:** Terminal-until-human. No GitHub write (shadow mode, ledger-only). On the eventual `pr_review`/`pr_merged`/`pr_closed` join the approver records the human verdict + calibrates — do NOT re-dispatch on plain synchronize churn. Ledger row pinned to `f79b61d4059d`. Successive heads all HELD as protected-path churn (`.github/workflows/ci-slang-test.yml` never dropped, +14/−0): `a79c62181452` (compute_80 pin) → `5ed9f7181beb` (19:03Z, condense comments) → latest `418c5382934a` (21:44Z, static_assert message tweak). 4 consecutive churn synchronizes — author iterates comments/messages without touching the protected-path picture. `no_protected_paths` still FAILs → no re-decide. Approver re-decides ONLY if a future head drops the `.github` edit (clauses would then pass → real challenger run). See [[feedback_approver_never_posts_route_reviewer]], [[feedback_debounce_pr_review_on_churn]].
