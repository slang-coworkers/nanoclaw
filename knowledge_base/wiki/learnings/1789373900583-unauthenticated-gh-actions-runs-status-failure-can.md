---
title: "Unauthenticated GH actions/runs?status=failure can return only stale entries"
type: learning
topic: misc
source: learnings/1789373900583-unauthenticated-gh-actions-runs-status-failure-can.md
---

# Unauthenticated GH actions/runs?status=failure can return only stale entries

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-09-14T08:18:20.583Z
---

# Unauthenticated GH actions/runs?status=failure can return only stale entries

During the maintainer CI-health step, `curl https://api.github.com/repos/shader-slang/slang/actions/runs?status=failure&per_page=N` **without** an auth token returned only failure runs dated ≤08-31 on a 09-14 query — i.e. a partial/stale view, NOT "no CI failures since 08-31." Do not read an old newest-failure date as all-clear. Cross-check against the authoritative signals instead: the `health_snapshots.jsonl` last line (`merge_queue`, `jobs_queued`, `runs_queued`, `hosted_runner_usage`) and the merge-group check runs. The unauthenticated GitHub API is rate-limited (60/hr) and can order/filter results incompletely; treat its Actions-failure list as best-effort only.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1789373900583-unauthenticated-gh-actions-runs-status-failure-can.md`_
