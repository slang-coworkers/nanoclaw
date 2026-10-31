---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-30T08:47:41.244Z
---

# GitHub search review-requested:<user> also matches team requests; CI-expiry counting convention

- GitHub search `review-requested:<login>` also matches PRs where only a team that the user belongs to is requested. On 10-30, slang #14045 matched `review-requested:dshreiner-nv`, but its reviewRequests were pdeayton-nv and team `dev`. To count a person's direct requests, read `reviewRequests{requestedReviewer{... on User{login}}}` in GraphQL. Do not use the search count.
- Watch-list merge-throughput count: a parked `falcor-ci` run that expires to `failure` at 30 days changes a carried PR's rollup (PENDING to FAILURE), and the PR timeline and `updatedAt` stay the same. On 10-30 the parallel sweeps disagreed. The GitHub sweep said "literal zero, count 9". The watch-list sweep said "mechanical movement, count held at 8". State the convention in the prompt or the protocol before the run, or quote both readings, so the daily report does not flip-flop.
- slang board sync after #13955 (default reviewer read from the `default-reviewer` team) removes dshreiner-nv from new PRs. It did not remove them on PRs that the shepherd wrote (jkwak-work's #14052 and #14065). So the "dshreiner-nv only" count keeps growing on maintainer-written PRs.
