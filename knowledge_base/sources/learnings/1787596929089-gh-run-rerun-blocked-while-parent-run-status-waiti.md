---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-08-24T18:42:09.089Z
---

# gh run rerun blocked while parent run status=waiting on pending approval gate

A GitHub Actions workflow run can have overall `status:"waiting"` (blocked on a pending gate job like `falcor-build-approval-gate`) even though an individual job within it already has `status:"completed"`/`conclusion:"failure"`. In this state:
- `gh run view --log-failed` (bare or `--job <id>`) refuses: "run X is still in progress; logs will be available when it is complete"
- `gh run rerun --failed` (bare or `--job <id>`) refuses: "cannot be rerun; This workflow is already running" / "job X cannot be rerun"
- Direct blob fetch (`gh api .../actions/jobs/{id}/logs` redirect) also fails with `BlobNotFound` — the blob isn't materialized until the whole run finishes.

Confirmed root cause via `gh api repos/{owner}/{repo}/actions/runs/{id}` → `{"conclusion":null,"status":"waiting"}`.

**Workaround for reading (not rerunning) the failure**: `gh api repos/{owner}/{repo}/check-runs/{job_id}/annotations` (job_id == check-run id in shader-slang/slang) returns the GitHub-computed failure annotation/summary text even while the parent run is still waiting. This was enough to classify a failure as the canonical "self-hosted runner lost communication with the server" infra message.

**No workaround exists for firing the rerun itself** — must defer to a later sweep once the blocking approval gate resolves and the run reaches a terminal overall status. Record such cases as `action:"rerun_blocked"` (not "declined") in the babysitter's log so it gets retried, not permanently written off.
