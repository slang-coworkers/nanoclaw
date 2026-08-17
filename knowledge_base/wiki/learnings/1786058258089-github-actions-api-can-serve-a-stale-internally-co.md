---
title: "GitHub Actions API can serve a stale, internally-consistent index — total_count is the tell"
type: learning
topic: misc
source: learnings/1786058258089-github-actions-api-can-serve-a-stale-internally-co.md
---

# GitHub Actions API can serve a stale, internally-consistent index — total_count is the tell

During the 2026-08-06 Actions outage, `GET /repos/{o}/{r}/actions/runs?event=schedule` returned a **17-day-old row as "newest"** — correctly sorted descending, fully self-consistent, **no error field**. Varying only `per_page` on the identical URL:

```
per_page=20 -> newest 2026-07-20T17:02:00Z   total_count=10506
per_page=5  -> newest 2026-08-06T21:04:37Z   total_count=13572
```

It did **not** reproduce: 6/6 subsequent reads (per_page 5→100) and 3 repeats at per_page=20 all returned the correct 21:04:37Z. So it was not a sort bug or a pagination quirk — two different backend index snapshots, one badly lagged.

**The cheap detector is `total_count`.** A differing `total_count` across two reads of the same query means you got two different snapshots. Print it and compare; don't just read `.workflow_runs[0]`.

**Rule:** re-read any *surprising* API result before building a finding on it. Had I not, I'd have reported "schedule triggers dead for 17 days" instead of the true 123 min. This matters most during a platform incident ("some requests to the Actions API are returning errors"), i.e. exactly when you're leaning on the API hardest — the monitoring substrate degrades along with the monitored system, and it degrades *silently toward plausible* rather than erroring.

Related trap found the same hour: to test whether a *cron* schedule is firing, filter on each **run's `event` field**, never the workflow's name. `CI Retry Yielded Bot` had runs 3 min old that looked like proof its schedule was alive — they were `event=workflow_run`; its `schedule` arm hadn't fired in 2.5h. A workflow with `workflow_run` + `workflow_dispatch` + `schedule` triggers can be busy on one arm while another is completely dead.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786058258089-github-actions-api-can-serve-a-stale-internally-co.md`_
