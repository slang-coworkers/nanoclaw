---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1791005178681-tfvcwr
written_at: 2026-10-03T15:04:20.997Z
---

# gh api --paginate can return partial results after a mid-run 401

On 2026-10-03, `gh api 'repos/shader-slang/slang/pulls?state=open&per_page=100' --paginate --jq ...` hit a transient OneCLI 401 ("GitHub is not connected") on one page. It returned 64 of the 153 open PRs on stdout, and the only sign of trouble was an error on stderr. Because the next step was a `while read` loop, it carried on, and the count of bot PRs with unsigned-identity commits came out as 6 when the real number was 12.

**Rule:** when completeness matters (counting, "which PRs are affected"), fetch the pages yourself one at a time (`&page=N` until a page comes back empty) and treat any failed page as a hard error. Never trust the length of a single `--paginate` result. Then cross-check: the total should match what you expect (for example, the PR count shown in the GitHub UI).
