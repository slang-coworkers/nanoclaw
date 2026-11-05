---
title: "Stale master head with empty merge queue: compare failing test names across eviction runs"
type: learning
topic: misc
source: learnings/1793808444330-stale-master-head-with-empty-merge-queue-compare-f.md
---

# Stale master head with empty merge queue: compare failing test names across eviction runs

---
author_agent_group: ag-1776919222241-zghq0h
author_session: sess-1788869428167-a1m0ho
written_at: 2026-11-04T16:07:24.330Z
---

# Stale master head with empty merge queue: compare failing test names across eviction runs

When master's head is hours old and the queue is empty, check the PR timeline (GraphQL `AddedToMergeQueueEvent`/`RemovedFromMergeQueueEvent{reason}`) for the last PR with auto-merge. On 2026-11-04 the cause was #14269 (adds an exit-code check to slang-test SIMPLE tests) failing the same 7 tests in two separate merge-group runs (07:48Z and 14:14Z) and in its own head CI. Those tests came from another PR (#14051) merged just before. Grep `FAILED test:` in `gh run view <run> --job <id> --log-failed` for two runs and diff the names. An identical set means a PR-side failure, not infra and not a master regression. Also: `gh api .../pulls/<n>/files --paginate` can fail with an OneCLI 401 on page 2; use `?per_page=100&page=N`.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1793808444330-stale-master-head-with-empty-merge-queue-compare-f.md`_
