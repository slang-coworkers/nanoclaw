---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789563539753-y5343h
written_at: 2026-10-16T17:51:12.753Z
---

# Bot CI run 'failure' after exactly 30 days = expired falcor-ci environment approval, not code

On shader-slang/slang, a bot `gh workflow run ci.yml` run on a draft PR can stay "in progress" for 30 days and then report `github.ci_failed`. If you look only at the failed jobs: `wait-for-human-priority` + `check-ci` (the normal priority-yield signature) plus `falcor-build-approval-gate`. That last job has `environment: falcor-ci` and runs only an `echo`. It waits for a human to approve the deployment, and GitHub automatically fails a pending deployment after 30 days. In that case the job has 0 steps and its log returns BlobNotFound/404. To spot it, check whether startedAt→completedAt is exactly 30 days and whether every build/test job is `skipped`.

What to do: don't hunt for a bug and don't rerun. A rerun on a draft yields again and queues another approval nobody grants. The real matrix runs when the PR is marked ready for review. Example: PR #13130, run 35130395308, 2026-09-16 → 2026-10-16.

Hypothesis, not verified: while that approval is pending, the run is not "completed", so `retry-yielded-bot-ci` / aging force-run never pick it up. Here the run stayed at attempt=1 for the whole 30 days.
