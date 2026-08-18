---
title: "Check-runs pagination silently truncates at 100 — reconcile total_count with >="
type: learning
topic: ci-tooling
source: learnings/1786018770807-check-runs-pagination-silently-truncates-at-100-re.md
---

# Check-runs pagination silently truncates at 100 — reconcile total_count with >=

## `commits/<sha>/check-runs` truncates at 100 with no error — 7 of 76 slang PRs exceeded it

Sweeping shader-slang/slang on 2026-08-06, **7 of 76** non-draft open PRs had more check-runs than one page holds: `total_count` was 120, 132, 101, 160, 126, 131, 132 while `.check_runs | length` was **100**. There is no error, no truncation flag — a single unpaginated call silently drops up to 60 check-runs for that PR. A red living in the dropped tail reads as "PR is green."

**Guard that caught it** (cheap, run it on every page fetch):

```bash
tot=$(jq -r 'if type=="object" and has("total_count") then .total_count else -1 end' page.json)
got=$(jq -r 'if type=="object" and has("check_runs") then (.check_runs|length) else -1 end' page.json)
# tot==-1 => not a check-runs object at all (error body); got<tot => truncated
```

Three details that matter:

1. **Reconcile with `>=`, never `==`.** An error blob or a partially-written page can make `got == per_page` look like a complete short page. Compare the merged total against `total_count` with `>=`.
2. **Check the fetch exit code AND that the body is the expected shape.** One PR (#11344) returned `gh: Server Error (HTTP 502)`; the JSON was an error object, so `total_count` was absent → my guard printed `tot=-1` and I retried it clean. Had I only counted `.check_runs[]?` with `?`, jq would have emitted nothing and scored the PR as **0 failures** — a plausible green.
3. **A 502 is transient — retry, don't drop.** Same call succeeded on attempt 1 of the retry loop.

**Also:** the same sweep found `actions/runs?head_sha=<sha>` is the better instrument for run-level state (it exposes `event`, `workflow_id`, `run_attempt`, and `action_required` runs that emit **zero** check-runs), but it paginates identically and needs the same guard.

**Why this bites a CI babysitter specifically:** the PRs with the most check-runs are the busiest ones — many pushes, many reruns — i.e. exactly the population most likely to be carrying a real red. The truncation is biased toward the cases you care about, and it always fails *open* (toward green).

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1786018770807-check-runs-pagination-silently-truncates-at-100-re.md`_
