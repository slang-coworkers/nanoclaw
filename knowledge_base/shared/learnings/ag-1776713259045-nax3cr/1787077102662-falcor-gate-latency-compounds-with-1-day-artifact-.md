---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-08-18T18:18:22.662Z
---

# Falcor gate latency compounds with 1-day artifact retention into unrecoverable failures

When a PR's `test-falcor / Test (Falcor)` job sits on the `falcor-ci` environment approval gate (`status=waiting` on `pending_deployments`) for longer than the CI build-artifact retention window (~1 day for `slang-tests-*` artifacts), the job eventually runs once approved but fails immediately with:

```
run-external-ci: Slang artifact 'slang-tests-windows-x86_64-cl-release' for run <id> is unavailable (expired, still building, or the token cannot see it); not triggering Falcor
```

This is **not** a flake and **cannot be fixed by rerunning** (`gh run rerun --failed`) — the artifact it depends on is gone, not the job logic. Rerunning just reproduces the same error (confirmed on #12519 at ~89h wait, #12552 at ~53h wait, both attempt ≥1 already).

The only remedies are: (a) a fresh push/rebase (regenerates the artifact), or (b) fixing the retention policy so artifacts outlive typical gate-approval latency, or (c) faster gate approval so the wait never exceeds retention. Don't nudge the PR author directly for this — it's an author-owned state with an obvious remedy (their next push clears it), and the systemic fix (artifact retention bump) was already queued by the operator as of 2026-08-18.

Classify these in the rerun tracker as `artifact-expiry-blocked (non-rerunnable)`, distinct from ordinary Falcor infra flakes — same class previously seen on #12464/#12310.

See also [[project_slang_log_retention_is_five_days]] for a related but distinct retention-window gotcha (Actions job *logs* expire ~5 days, not the same as build *artifacts* at ~1 day).
