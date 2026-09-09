---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788453217339-x8vsq7
written_at: 2026-09-03T17:51:07.847Z
---

# Post-rebase cross-platform test-slang failure on a PR is often a master semantic-merge break, not the PR

When a PR's `test-slang` job fails **deterministically on every platform (incl. CPU-only/aarch64, no GPU) right after a rebase**, and the failing tests are unrelated to the PR's diff, suspect a master-level semantic merge conflict, not the PR.

Concrete case (shader-slang/slang PR #12860, SPIR-V matrix debug types): after rebase, 8 `test-slang` jobs failed on two **autodiff** tests (`tests/autodiff/forward-derivative-of-generic-overload.slang.1`, `tests/diagnostics/autodiff-non-forward-derivative-of-generic-overload.slang`). Root cause: #12830 (`6ca28af6ae`) added a new warning `E40021 "deprecated generic-parameter-count overload tie-breaker"`; #12828 (`8a2a3ed748`) last touched those tests and merged ~2 min earlier without containing #12830. Neither PR's CI saw the other's state → master ships tests that trigger a warning they don't annotate → every rebasing PR inherits the red.

Triage recipe that nailed it fast:
- Individual job logs when the run is still in-progress: `gh api repos/OWNER/REPO/actions/jobs/JOBID/logs --allow-escape-sequences | sed 's/\x1b\[[0-9;]*m//g; s/\r//g'` (the `gh run view --log` path returns "still in progress").
- Find the deterministic failure on a **CPU/aarch64** job (strip GPU noise); grep `FAILED test:`.
- Attribute the diagnostic: `git log origin/master -S "<warning text>"` finds the introducing commit; `git log origin/master -- <testfile>` finds who last touched the test; `git merge-base --is-ancestor <warnCommit> <testCommit>` proves the test PR predates the warning.
- Prove master is broken independent of the PR: `git grep "<warning marker>" origin/master -- <testfiles>` returns nothing = tests don't expect the warning the compiler now emits.

Action: file the fix issue against master (test-expectation update), attribute to the deprecation PR's owner, and tell the innocent PR author there's nothing to fix on their side — rebase after the master fix. Do NOT push a "fix" onto the innocent PR.

Contrast with the earlier failure on the same PR: `test-falcor` failed in 18s with `run-external-ci: trigger failed: HTTP Error 403: Forbidden` — that's infra (external-CI bridge trigger rejected), never compiled a shader. 403/download/VCS-root = infra; a `FAILED test:`/compile error reproducing on CPU = real.
