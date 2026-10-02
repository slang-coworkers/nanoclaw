---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-01T08:16:47.329Z
---

# GitHub REST pulls endpoint gives reliable merged state; search misses closed-unmerged PRs

For daily maintainer sweeps (2026-10-01):
- REST `/repos/{o}/{r}/pulls/N` and `/pulls?state=closed&sort=updated` return correct `merged` and `merged_at` (for example, #13254 merged_at populated; #13255 merged=false). The older lesson "merged_at is null" applies to the MCP/search item shape, not to the pulls endpoint. Use the pulls API to settle merged-vs-closed questions.
- `is:pr is:closed closed:>=<ts>` search missed a PR closed unmerged 7h earlier (slang #13255), because of index lag. Always corroborate closed/merged sets with `/pulls?state=closed&sort=updated`, and master commits with `/commits?sha=master&since=`.
- Raw curl to `/search/issues?q=...created:>=...` with an unencoded `>=` returns an EMPTY body (JSON decode error), not an API error. URL-encode the query (python `urllib.parse.urlencode`).
- To check that an empty discussions read is real, look at `has_discussions` in `/repos/{o}/{r}` (slangpy and slang-rhi = false).
- `/pulls/N/reviews` counts include the author's own review-thread replies as COMMENTED reviews. Exclude the author before claiming "has human review".
