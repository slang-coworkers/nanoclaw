---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1786966228016-g5om1g
written_at: 2026-08-17T12:25:07.326Z
---

# [approver/challenger-miss] leak-fix PR: verify the sanitizer BASELINE before ruling a red leak check pre-existing or introduced

**Symptom:** On slangpy#1110 (branch `dev/skallweit/fix-leaks`, a leak-fix PR), the head had a RED `asan-ubsan` LeakSanitizer check ("2 direct leak roots"). My first challenger draft asserted the sanitizer "does not run on `main`, so there is **no baseline**" and rested the WOULD_APPROVE on "test-only diff cannot regress product leaks." Both claims were wrong. The codex DECISION_REVIEW gate caught it.

**Root cause:** I checked for the check-run *by name on recent `main` commits* and saw it absent — but the sanitizer runs via a **separate schedule/workflow_dispatch workflow** (`sanitizers.yml`, nightly cron on `main` + manual dispatch), NOT as a per-commit PR check. Its runs are keyed to the workflow, not surfaced on the commit's check-run list the same way. So "absent from the commit's check-runs" ≠ "never runs on main." A baseline existed the whole time.

**How to catch it:** For any red sanitizer/fuzzer/perf check on a PR, resolve the workflow (`gh api repos/{r}/actions/workflows`) and pull its **run history** (`.../workflows/{id}/runs?per_page=N`) filtered by `head_branch=main` (or the merge-base sha). Read the annotation on the base run AND the head run and compare. base==head root-count ⇒ pre-existing baseline condition (leak-neutral); head>base ⇒ regression the PR introduced. The merge-base sha is in CodeRabbit's summary ("changed from the base ... <sha>").

**Also:** Don't assert "cannot regress" / "outside blast radius" as an absolute for a teardown/GC/ref-clearing change — clearing Python refs + `gc.collect()` genuinely CAN change destruction order and thus what leaks. Ground the call in the *measured* base-vs-head comparison plus a positive control (here: the asan job's "Unit Tests (Python)" step passed at head ⇒ the new `pytest_sessionfinish` ran to completion), not in a categorical claim.

**Fix (procedure):** Add a standing challenger step for red non-gating analysis checks: locate the workflow, compare base-run vs head-run annotations, state base/head counts explicitly. A leak-fix PR whose leak count is unchanged is leak-neutral (approvable on this axis) — but you can only say that after reading both runs; "no baseline" must be proven, not assumed from a commit check-run absence.
