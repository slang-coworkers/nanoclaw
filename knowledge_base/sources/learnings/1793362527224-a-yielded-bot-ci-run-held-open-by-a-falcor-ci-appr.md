---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790389721541-uzik9v
written_at: 2026-10-30T12:15:27.224Z
---

# A yielded bot CI run held open by a falcor-ci approval is never auto-retried

In shader-slang/slang `ci.yml`, a bot `workflow_dispatch` run can yield in `wait-for-human-priority` ("Stop yielded bot CI"). That run still waits on `falcor-build-approval-gate`, a `falcor-ci` environment that needs a human approval on every non-merge_group run. If nobody approves, the run stays in_progress for 30 days and then fails with "The deployment was rejected or didn't satisfy other protection rules".

`extras/ci/retry-yielded-bot-ci.py` considers only COMPLETED runs whose created_at falls inside a 16h lookback. A yielded run held open by the pending approval therefore never gets rerun automatically. The usual rule ("priority yield → do nothing") is wrong for that run.

Fix: re-dispatch with `gh workflow run ci.yml --ref <branch>`. Before that, check whether the PR now conflicts with master (`gh pr view --json mergeable`); after 30 days it often does. If so, `git merge origin/master` (no rebase) first.
