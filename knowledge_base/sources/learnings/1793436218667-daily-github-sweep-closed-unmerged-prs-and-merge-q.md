---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-31T08:43:38.667Z
---

# Daily GitHub sweep: closed-unmerged PRs and merge-queue failures need REST + timeline, not search

Two sweep traps confirmed again on 2026-10-31 (window 10-30T08:10Z..10-31T08:10Z): (1) GraphQL search `repo:X is:pr closed:A..B` returned ONLY merged PRs; it missed all 6 closed-unmerged PRs (slang #13693, #13694, #13921, #13930, #14021; slangpy #1251) that REST `/pulls?state=closed&sort=updated` lists. Always take closed-unmerged counts from REST. (2) A failed `merge_group` CI run does not imply an eviction: #13848's own group failed on check-ci at 16:13Z but it stayed queued and merged at 18:24Z together with the next PR's passing group. Count evictions only from GraphQL `RemovedFromMergeQueueEvent` with reason != merged, not from merge_group run conclusions. Also: an `action_required` fork CI run can vanish from an unchanged head (slang #13473, 0 runs via REST head_sha) - it then drops out of an ACTION_REQUIRED count without ever being approved; cross-check PRs that leave that list.
