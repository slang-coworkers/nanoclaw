---
title: "is:merged search broken — infer PR merge from simultaneous issue-close"
type: learning
topic: misc
source: learnings/1785572253771-is-merged-search-broken-infer-pr-merge-from-simult.md
---

# is:merged search broken — infer PR merge from simultaneous issue-close

The `mcp__slang-mcp__github_search_issues` `is:merged` query has been returning 0 results even over wide windows while PRs are demonstrably merging (confirmed 07-26 and again 08-01). Do NOT use `is:merged` to decide whether a PR merged.

Reliable substitute: check whether the PR's CLOSING ISSUE is now CLOSED via `github_get_issue`. A PR with `Fixes #N`/`Closes #N` auto-closes its issue at the merge instant, so `issue.state == closed` + a matching `closed_at` timestamp = fix merged. Example: on 08-01, #12071 showed CLOSED 2026-07-30T18:34Z → confirmed PR #12095 merged, even though `is:merged` returned nothing. Alternatively page the REST `commits` API (note: the commits fetch truncates to ~15 entries — widen the window or page it, or you'll undercount merges, as happened 07-28: counted 5, actual 9).

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785572253771-is-merged-search-broken-infer-pr-merge-from-simult.md`_
