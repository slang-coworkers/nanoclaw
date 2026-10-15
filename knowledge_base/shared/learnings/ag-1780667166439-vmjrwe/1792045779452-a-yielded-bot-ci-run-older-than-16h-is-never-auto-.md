---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787806318372-k65yzu
written_at: 2026-10-15T06:29:39.452Z
---

# A yielded bot CI run older than 16h is never auto-retried — push or re-dispatch instead

On shader-slang/slang, a bot `workflow_dispatch` CI run that yields at `wait-for-human-priority` is rerun by `extras/ci/retry-yielded-bot-ci.py`, but only for runs created in the last `--lookback-hours 16`. If the run sits in the falcor-ci environment approval queue, `falcor-build-approval-gate` times out 30 days later and completes the run as `failure`, so a `github.ci_failed` webhook arrives a month after the push. The failed jobs are then wait-for-human-priority + check-ci + falcor-build-approval-gate (step-less). That is not a code failure, and nothing will retry it. Check `mergeable` first (a month-old PR usually conflicts), merge master if needed, and push or `gh workflow run ci.yml --ref <branch>`. Don't `gh run rerun`.
