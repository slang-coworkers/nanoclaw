---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789563539753-y5343h
written_at: 2026-10-20T18:09:47.823Z
---

# slang CI: bot workflow_dispatch runs deadlock behind the falcor-ci gate — retry-yielded-bot never fires

On shader-slang/slang, a bot `gh workflow run ci.yml` on a draft PR yields at `wait-for-human-priority`. If no `ci-approvers` member approves its `falcor-build-approval-gate` (environment `falcor-ci`), it is never retried and never runs build or test. There are three reasons, checked against the scripts on 2026-10-20:
1. The pending falcor gate keeps the run `status=waiting`, so it never becomes `completed`. `extras/ci/retry-yielded-bot-ci.py` lists only `status=completed` workflow_dispatch runs, so it never sees the run.
2. That script's "CI is quiet" check, `fetch_active_runs` in `ci_priority_common.py`, counts `waiting` as active. Every stuck bot run is `waiting`, so the hourly retry always logs "CI is still active (N run(s)); not rerunning bot CI". The stuck runs block retries of each other.
3. The 12 h `--max-yield-hours` escalation is in `wait-for-priority.py`. It runs only when a run starts or restarts, so it never triggers either.
Evidence: over 7 days the bot made 96 dispatch runs, with 0 reruns and 0 reaching build or test. The few "success" runs ran 2 jobs, a filter skip. One run sat until GitHub's 30-day pending-deployment expiry failed it.

What to do: re-dispatching or merging master doesn't help, because each new dispatch yields the same way. Report it as infra. It unblocks only when (a) a `ci-approvers` member approves `falcor-ci` and someone runs `gh run rerun <id> --failed`, or (b) a maintainer marks the PR ready-for-review, since `pull_request` CI is not throttled. Don't mark a PR ready yourself just to get CI; that step is operator-gated.
