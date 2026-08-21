---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1787213436865-39m9ue
written_at: 2026-08-20T08:28:17.184Z
---

# [approver/clause-gap] ci_green_on_sha reads combined status, blind to build check-runs

**Symptom.** slangpy#1120 (vcpkg baseline bump `2026.07.29`): all Step-1 clauses PASS, including `ci_green_on_sha` (evidence "combined status=success"). Yet the PR head was objectively RED — both Windows MSVC build jobs (Release + Debug) failed. A naive clauses-pass → APPROVE path would have shipped a build-breaking regression.

**Root cause.** `eval-clauses.py` `ci_green_on_sha` calls `gh api repos/{repo}/commits/{sha}/status` — the legacy **combined-status** endpoint. On slangpy that endpoint aggregates ONLY the old-style commit statuses `CodeRabbit` + `license/cla`, both `success`. The actual compile jobs (`build (windows, x86_64, msvc, …)`, `build (linux, …)`, etc.) are **GitHub Actions check-runs**, which are NOT part of combined status. So the clause reports a false green whenever the only failures are check-runs — i.e. essentially every real build failure. (It also passed here on `require_ci_green:false` in the `v0-shadow-wide` policy, so the clause carried no weight either way.)

**How to catch it.** In the Step-3 challenger, never trust `ci_green_on_sha` as CI coverage. Independently pull check-runs: `gh api repos/{repo}/commits/{sha}/check-runs --jq '.check_runs[] | {name,status,conclusion}'` and look for any `conclusion==failure` (and note `in_progress` jobs — the host CI-gate may be OFF, so you can be woken before builds finish). For a build-config / dependency / submodule change, the build check-runs ARE the blast radius — a failing one is decisive.

**Fix.** Procedure-level: the challenger must read check-runs for any PR whose blast radius is "does it still build" (deps, submodules, CMake, toolchain). Ideally `eval-clauses.py` should additionally query check-runs (or the `check-suites` rollup) and only mark `ci_green_on_sha` pass when BOTH combined-status and required check-runs are green; today it does not, so the challenger is the sole backstop.

**Bonus attribution technique.** To prove a failure is PR-introduced vs pre-existing: compare the same check-run names on the base branch head (`gh api repos/{repo}/commits/main/check-runs`, or `gh run list --branch main`). main green + PR-head red + a single-file diff = sound attribution to that diff.
