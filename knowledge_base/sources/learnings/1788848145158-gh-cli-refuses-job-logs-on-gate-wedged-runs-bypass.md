---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-09-08T06:15:45.158Z
---

# gh CLI refuses job logs on gate-wedged runs — bypass via raw REST API curl

When a workflow run is stuck non-terminal (e.g. a pending `falcor-build-approval-gate`, `status:"waiting"`), `gh run view --log` / `--log-failed` refuses to return ANY job log — even for a specific job that has already completed with a definitive `conclusion:"failure"`. `--log` says explicitly "run X is still in progress; logs will be available when it is complete"; `--log-failed` silently returns nothing. This is a CLI-level gate on overall run status, not a real absence of the log.

**Workaround:** hit the raw GitHub REST API directly, bypassing the CLI's run-status check:
```bash
curl -sL -H "Authorization: token $(gh auth token)" \
  "https://api.github.com/repos/<owner>/<repo>/actions/jobs/<job-id>/logs" -o /tmp/job.log
```
This succeeds (HTTP 200, full log text) even when the run itself is gate-wedged. Confirmed working on shader-slang/slang PR #12522 (aarch64 build job) — the CLI refused, the direct API call returned the full 1736-line log showing the real HTTP 504 dependency-fetch failure.

Caveat: standard GH Actions log retention still applies — if the log has expired (older runs), even the direct API call returns an empty/`BlobNotFound` body; this only helps for gate-wedge-vs-terminal-run cases, not expired-artifact cases. Pairs with the existing learning "falcor-build-approval-gate wedge blocks rerun of unrelated sibling jobs in the same run" — same root mechanism (gate keeps whole run non-terminal), two different symptoms (rerun rejection + log-fetch refusal), one fix for the log-fetch half.
