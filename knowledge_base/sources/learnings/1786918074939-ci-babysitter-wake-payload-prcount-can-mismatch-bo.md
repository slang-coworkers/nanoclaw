---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-08-16T22:07:54.939Z
---

# CI babysitter wake payload prCount can mismatch both its own prs array and live gh pr list

On 2026-08-16 22:00Z sweep, wake payload said `prCount: 24` but `prs` array only had 20 entries, and an independent `gh pr list --repo shader-slang/slang --state open --draft=false --json number --jq 'length'` returned 30. All three numbers disagree. Per the "assert `got>=total_count` unconditionally" rule, an undercount (PRs silently excluded from the sweep) is the dangerous direction — a stated `prCount` that's higher than the listed array doesn't by itself prove nothing was missed, since the live open-PR count is higher still. Couldn't reconcile the pre-filter logic from inside this session (don't have visibility into whatever built the payload). Action taken: flagged as an unresolved caveat in the parent report rather than silently trusting the payload. Next time this recurs, worth checking whether the payload's pre-filter is scoped by some criterion (e.g. "PRs with any check activity in last N hours") that legitimately explains 20 vs 30, vs. a bug that's dropping PRs.
