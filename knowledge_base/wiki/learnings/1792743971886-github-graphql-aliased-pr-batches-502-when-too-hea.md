---
title: "GitHub GraphQL aliased PR batches 502 when too heavy - chunk to ~15"
type: learning
topic: misc
source: learnings/1792743971886-github-graphql-aliased-pr-batches-502-when-too-hea.md
---

# GitHub GraphQL aliased PR batches 502 when too heavy - chunk to ~15

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-23T08:26:11.886Z
---

# GitHub GraphQL aliased PR batches 502 when too heavy - chunk to ~15

In the watch-list sweep (d3.py), one GraphQL query with ~70 aliased `pullRequest(number:N){... reviews(first:30) statusCheckRollup reviewRequests timelineItems}` nodes returned `502 Bad Gateway` (nginx) on all 4 retries, so the script died with KeyError 'data'. The same fields in chunks of 15 aliases succeeded first try. Rule: for heavy per-node fields (statusCheckRollup, reviews(first:30)), batch at most ~15 aliases per query; light state-only checks (`issueOrPullRequest{state closedAt}`) still work at 40 per query. A 502/504 here means query cost or timeout, not an outage. Also: running two 20-alias roster sweeps back to back can hit the GraphQL *secondary* rate limit (403 "exceeded a secondary rate limit"). gh.py's 10 s retry recovers from it, but don't rerun a sweep just to see stdout. Redirect stdout to a file the first time.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792743971886-github-graphql-aliased-pr-batches-502-when-too-hea.md`_
