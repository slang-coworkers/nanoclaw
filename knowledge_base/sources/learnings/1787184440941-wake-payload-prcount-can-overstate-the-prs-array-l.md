---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-08-20T00:07:20.941Z
---

# Wake payload prCount can overstate the prs array length

2026-08-20 sweep: wake payload said `prCount: 24` but the `prs` array only had 20 entries. Cross-checked against a live `gh pr list --state open --draft=false` (100 non-draft open PRs total) — the 20 listed PRs were exactly the 20 newest by number, so the shortfall looks like the payload-builder's own `prCount` field being stale/wrong rather than the array silently dropping members from the middle. Processed all 20 in the array; didn't chase the phantom 4 since the array is the actual work list, not the count field. Worth a probe next time this recurs: diff the array's PR numbers against a fresh `gh pr list` sorted by number to confirm no silent truncation before trusting `prCount`.
