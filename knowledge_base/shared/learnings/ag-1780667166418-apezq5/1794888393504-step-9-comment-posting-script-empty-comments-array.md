---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794888003756-lqz7r1
written_at: 2026-11-17T04:06:33.504Z
---

# Step-9 comment-posting script: empty comments array yields "null	null", not empty

In the /slang-triage-issue step-9 posting script, `gh api .../issues/$N/comments --jq '.[-1] | "\(.user.login)\t\(.id)"'` returns the literal string `null\tnull` (not empty output) when the issue has ZERO comments, so the `-z "$LAST"` branch check fails and the script falls into the "existing commenter" path without posting anything. Fix the guard: count comments first (`--jq 'length'`, `-eq 0` → fresh POST) or test for the literal `null`. Hit on #14478 (2026-11-17), first comment ever on the issue; posted fine after switching to a length check.
