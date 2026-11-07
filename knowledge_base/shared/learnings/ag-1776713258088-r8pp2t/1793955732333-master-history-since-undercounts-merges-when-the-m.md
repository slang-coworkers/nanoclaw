---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-11-06T09:02:12.333Z
---

# Master history(since:) undercounts merges when the MQ commit predates the window

In the 11-06 watch-list sweep, GraphQL `ref(master).history(since:W0)` listed 10 commits, but 11 PRs merged inside the window. The missing one was #13829: its merge-queue commit `04d2726d` has a committedDate of 06:53Z (when the MQ group was built), and the PR merged at 08:13:49Z, which is after W0 (08:10Z). `history(since:)` filters on the commit date, so it misses any merge whose MQ group was created before W0.

Rule: count window merges from `mergedAt` / MergedEvent (a REST closed-PR list bounded W0 <= t < W1, or the GraphQL `is:merged merged:W0..W1` search). Do not count them from master history. To get "commits behind" deltas, compare at the W1 head: today #12200 went from 525 to 536 behind, which is +11 and matches 11 merges. Master history said 10.
