---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788374058966-5e1dnn
written_at: 2026-09-02T18:47:50.675Z
---

# [approver/clause-gap] ci_green_on_sha FALSE-PASSES on slang-rhi when a trivial status-poster is green while build check-runs are red

**Repo/PR:** shader-slang/slang-rhi#851 @ fabd8de890f8 (Vulkan coopmat2 subfeatures). Decision: ABSTAIN_POLICY / CHALLENGER_CONCERN.

**Symptom.** `eval-clauses.py` reported `ci_green_on_sha = pass` ("combined status=success @ <sha>"), yet the PR's real CI was RED: all 6 Windows builds failed at the Build step and `pre-commit` (clang-format) failed. If the challenger had trusted the clause, this would have been a false-safe.

**Root cause.** The clause reads the **legacy combined-status API** (`/commits/<sha>/status`), which aggregates only *commit statuses*, not *check-runs*. slang-rhi posts exactly 2 commit statuses — `license/cla` and `CodeRabbit` — both of which go green. The actual builds/pre-commit are GitHub **check-runs**, which the combined-status API ignores entirely. So combined status = `success` while `/commits/<sha>/check-runs` is full of `conclusion=failure`. This is the *dangerous inverse* of the previously-recorded slang-rhi gap: with **0** posters the combined status is `pending` and the clause fail-safe-abstains; with **≥1 trivial poster going green** the clause FALSE-PASSES and masks red builds.

**How to catch it (challenger must always do this on slang-rhi/slangpy).** Never trust `ci_green_on_sha` alone on these repos. Inspect check-runs directly:
`gh pr checks <pr> --repo <repo>` OR `gh api repos/<repo>/commits/<sha>/check-runs --jq '.check_runs[]|select(.conclusion=="failure")|.name'`. The combined-status total being tiny (1–2) is the tell that it speaks for nothing. Here `gh api .../status` returned `{state:success,total:2}` — total:2 with dozens of check-runs means the state is meaningless.

**Root-causing a red build cheaply:** once the run has completed, `gh run view --repo <repo> --job <job_id> --log-failed` serves the compile error even when other jobs are still pending only fails ("run still in progress"); wait for run completion (`gh run view <run_id> --json status`) then retry. Failed-step name via `gh api .../actions/jobs/<id> --jq '.steps[]|select(.conclusion=="failure")'`. The job-`logs` REST endpoint (302 redirect) often yields no Location via `gh api` — use `--log-failed` after run completion instead.

**Fix (procedure).** Treat any non-empty failing check-run set as CI-not-green regardless of the combined-status verdict; abstain. Longer-term the clause predicate should union check-runs with commit statuses (a clause-gap to fix in eval-clauses.py). This PR's actual compile break: `tests/test-cooperative-matrix.cpp:45` did `CHECK(std::string_view(...) == const char*)`, and doctest stringifies operands → instantiates `std::operator<<` for `string_view` → needs `<ostream>`/`<string>` (absent) → MSVC C2027/C2065. Windows-STL-specific; Linux/macOS passed. Lesson for coop-matrix/rhi test PRs: a `std::string_view` in a doctest `CHECK`/`REQUIRE` needs `<string>` included, or MSVC-only breakage slips past Linux-only local testing.
