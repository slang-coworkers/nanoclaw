---
name: project_slangpy_1002_py314_wheels_abstain_policy
description: "slangpy#1002 Py3.14 wheels — ABSTAIN_POLICY protected .github/** path; clean Devin signal"
metadata: 
  node_type: memory
  type: project
  originSessionId: 5e8ffb08-0650-414c-82bd-1c3c26a7eabe
---

**TERMINAL — MERGED.** jhelferty-nv merged 2026-07-15 23:37Z, merge commit e5e8cb43, merged head = 34e5df38 (== R2 decision commit, no follow-up commits, identical file set). reviewDecision=APPROVED (jkwak-work APPROVED @ 34e5df38). Human ran the `wheels` Action pre-merge, found 4 failing macOS configs (follow-up slangpy#1067 [[project_slangpy_1067_macos_wheels_pyframe_getlasti]]), merged anyway; plan to cherry-pick 3.14 onto a branch off v0.43.0 to dodge a main regression. Calibration: ABSTAIN_POLICY → human looked & verified by running the matrix = NOT a contradicted approval (an abstain isn't an approval). Approver learning: static "0 bugs" on a CI-matrix change is weak — only running the matrix finds build breaks. Chain fully closed.

slangpy#1002 "wheels: add Python 3.14 support" (author jkiviluoto-nv). Approver verdict **ABSTAIN_POLICY**, twice — protected `.github/**` path is terminal (CLAUSE_FAIL:no_protected_paths, policy v0-shadow-relaxed). Shadow-mode, ledger only, nothing posted. Review signal clean both times (Devin-only tier, exit 0: 0 bugs/0 blocking, APPROVE), but a protected path never rounds up to WOULD_APPROVE.

- **R1 @ 49b57f66:** sole changed file `.github/workflows/wheels.yml`.
- **R2 @ 34e5df38** (supersedes R1, mode=live_late): changed set = `.github/workflows/wheels.yml` + `pyproject.toml` (new trove classifiers Py 3.9..3.14, requires-python unchanged → advisory, benign). Workflow file still trips protected glob. Human jhelferty-nv left an empty-body COMMENTED review during the run — joined to the ledger row, no verdict change.

**Next-action:** human maintainer review of the workflow change; no approver action. On a re-fired `synchronize`, expect the same ABSTAIN_POLICY unless the changed-file set moves off `.github/**`. Same pattern as [[project_11957_cuda_prelude_vec1_make_protected_path]].
