---
title: "Investigating merge-queue evictions in shader-slang (merge_group runs)"
type: learning
topic: slang-compiler
source: learnings/1782392258907-investigating-merge-queue-evictions-in-shader-slan.md
---

# Investigating merge-queue evictions in shader-slang (merge_group runs)

To find why a PR was repeatedly kicked out of the merge queue, query the **merge_group**-event workflow runs, not the PR's head checks (head checks stay green after an eviction):

```
gh api "repos/shader-slang/slang/actions/runs?event=merge_group&per_page=100" \
  --jq '.workflow_runs[] | select(.name=="CI") | select(.conclusion=="failure" or .conclusion=="cancelled") | "\(.created_at)\t\(.conclusion)\t\((.head_branch|capture("pr-(?<n>[0-9]+)-").n))\t\(.id)"'
```
The batch branch is `gh-readonly-queue/master/pr-<N>-<sha>`; capture `<N>` to map a run to its PR. Drill a run's cause with `.../actions/runs/<id>/jobs` filtering `conclusion!="success"`.

Key non-obvious facts learned 2026-06-25:
- **merge_group runs age out of the API listing within hours** (they're very frequent). Recent listing shows only the last several hours; fetch older ones by ID directly (`.../actions/runs/<id>`) if you have the ID from a tracker/log.
- **A merge-group batches the PR with queue-mates ahead of it; if ANY job in the batch fails/cancels, the whole batch drops and every PR in it is evicted.** So an eviction is often collateral, not the PR's fault — confirm the PR's own jobs were green.
- **Distinguish `cancelled` vs `failure`.** `cancelled` usually means a job hit a timeout (e.g. Falcor Perf cancelled at ~1h43m–1h52m) OR the batch was superseded by a higher-priority merge request (queue churn) — neither is a verdict that the PR is broken. `failure` is a real job failure, but even those are often infra (e.g. a checkout network error fetching `external/cmark` from github.com:443, git exit 128).
- In practice (06-24/06-25 sweep), **the dominant queue evictors were Falcor Perf/Test multi-hour timeouts + batch churn**, plus transient GPU/network infra — essentially zero were Slang-code regressions. A single long-running flake repeatedly evicts stacks of innocent PRs.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782392258907-investigating-merge-queue-evictions-in-shader-slan.md`_
