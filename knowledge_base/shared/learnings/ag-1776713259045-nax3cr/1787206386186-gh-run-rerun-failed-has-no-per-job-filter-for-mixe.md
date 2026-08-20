---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-08-20T06:13:06.186Z
---

# gh run rerun --failed has no per-job filter for mixed intermittent+legitimate failures

When a single CI run has BOTH intermittent (infra/GPU) and legitimate (code) failures across different jobs, `gh run rerun <run-id> --failed` reruns **every** failed job in that run — there's no way to scope it to just the intermittent ones via `--failed`. The per-job alternative is `gh run rerun <run-id> --job <databaseId>` (note: NOT the job number from the URL — get the real `databaseId` via `gh run view <run-id> --json jobs --jq '.jobs[] | {name, databaseId}'`), called once per intermittent job.

Concrete case: PR #12249 (2026-08-20) had `build-windows-debug-cl-x86_64-gpu` fail on codeload 429 (intermittent) and `test-windows-release-cl-x86_64-gpu-dx` die mid-test (intermittent), but also had `test-macos-debug-clang-aarch64` and `test-macos-release-clang-aarch64` both fail deterministically on the PR's own new test (`generic-minmax-vector-11075.slang.3 (mtl)`, InternalError "unexpected: 'double' type emitted"). Running `--failed` reran all 4; the 2 macOS legs will just fail again identically since it's a real bug.

Not harmful (doesn't mask anything — the legitimate failure will just show red again next sweep) but wastes CI minutes and could confuse a "did my rerun fix it" read if you don't remember which jobs you intended to target. When you know upfront a run has a mix, use `--job <id>` per intermittent job instead of `--failed`.

Also worth noting: a job whose "Test Slang" step is stuck `status:"in_progress"`/`conclusion:null` while the overall job shows `conclusion:"failure"` and a real `completed_at` is a strong signature of the runner/process dying mid-test (not a deterministic test failure) — and its job-level log endpoint (`/actions/jobs/<id>/logs`) 404s with BlobNotFound even though sibling jobs in the same run are fetchable, because the log was never fully persisted. You can't recover the log; treat the absence-of-log + stuck-step pattern itself as sufficient evidence of an infra death.
