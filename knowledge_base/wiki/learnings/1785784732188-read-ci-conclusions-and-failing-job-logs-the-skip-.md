---
title: "Read CI conclusions and failing job logs — the skip pattern can't tell you why a check went red"
type: learning
topic: agent-ops
source: learnings/1785784732188-read-ci-conclusions-and-failing-job-logs-the-skip-.md
---

# Read CI conclusions and failing job logs — the skip pattern can't tell you why a check went red

I told a maintainer a red X on a draft Slang PR was "the draft-CI artifact" (ci.yml filters drafts on `pull_request`, so a manual dispatch yields and all build jobs skip). Wrong cause. Draft filtering explained the 74 skipped check-runs, but the two `failure` conclusions were the **priority gate deliberately yielding**:

```
Yielding to human/merge CI #29710 (pull_request, in_progress, by <human>)
Yielding to human/merge CI #29707 (merge_group, in_progress, by <human>)
Yielding behind earlier bot CI #29711 (pull_request, in_progress, by nv-slang-bot[bot])
Higher-priority CI is active. Marking this bot run for retry.
##[error]priority-gate-yielded: higher-priority CI is active; ci-retry-yielded-bot will rerun this bot CI when quiet
```

**Method (the generalizable part):** counting skipped jobs tells you *a filter ran*, not *why the check rolled up red* — the skip pattern is identical under both explanations. Read the `conclusion` field for every check-run, then open the log of each `failure`. Both failing runs here had `output.summary: null`, so the job log was the only source: `gh api repos/<o>/<r>/actions/jobs/<job_id>/logs`. A green/red rollup is a summary; the reason is never in the summary.

**Why the distinction was load-bearing, not pedantic:** "draft artifact" implies nothing changes until the ready-flip. The real cause self-heals — `ci-retry-yielded-bot` (active, 3k+ runs) reruns gate-yielded bot runs when the queue is quiet, and `wait-for-priority.py`'s `--max-yield-hours` (default 12) aging path escalates a long-waiting run so it can't starve. Telling a maintainer the wrong mechanism leaves them waiting on something that will never happen, or misreading a persisting X as newly broken.

**Don't overstate the self-heal either** (two review rounds caught me): the retry only considers runs within `--lookback-hours` (16), under `--max-attempts` (30, checked independently of age — and `workflow_run: [completed]` triggers can burn attempts faster than hourly, so the cap can be hit before 12h aging), skips a run superseded by a newer dispatch on the same branch, and reruns `--max-reruns` (1) candidate per invocation, selected **oldest** by `run_number` (`sorted(candidates, key=run_number)`) — not the latest.

Same failure class as reading a repo-wide sweep from a stale base: the artifact answered honestly about a different state of the world.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1785784732188-read-ci-conclusions-and-failing-job-logs-the-skip-.md`_
