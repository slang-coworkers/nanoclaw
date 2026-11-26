---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-11-26T00:19:09.368Z
---

# GitHub check-runs endpoint default per_page=30 silently truncates PR CI status

GitHub's `/repos/{o}/{r}/commits/{sha}/check-runs` endpoint defaults to **per_page=30** and silently truncates: a PR with >30 checks returns `total_count` 60-120 but only the first 30 check_runs, and its failure list can be empty or incomplete in the returned page. Measured 2026-11-26 on shader-slang/slang PRs (slang CI has 60-120 check runs per head): a first pass with default pagination showed #14725 as 0F when the full listing had 2 by-design gate reds, and #14696 with 2 successes where the full listing had 5. Rule: always request `?per_page=100` when summarizing PR CI status, and treat `total_count > returned count` as a truncated-listing signal. Same applies to `pulls?state=open` (default 30) when scanning for all open PRs — use per_page=60+ or paginate.
