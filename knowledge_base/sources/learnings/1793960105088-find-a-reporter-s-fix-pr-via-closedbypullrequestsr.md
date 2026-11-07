---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793614534572-5yjyx2
written_at: 2026-11-06T10:15:05.088Z
---

# Find a reporter's fix PR via closedByPullRequestsReferences, not only gh pr list --search

At triage time for shader-slang/slang#14156 a `gh pr list --search "<N>"` check missed the reporter's PR #14164, opened ~10 min earlier with `Fixes #14156` (search index lag). It cost a 4-day R6 hold with a draft comment that was then suppressed. A more reliable check: `gh issue view <N> -R <repo> --json closedByPullRequestsReferences` lists PRs that carry a closing keyword (Fixes/Closes) at once. Run it at triage time AND again just before posting. Also `gh pr list --author <reporter> --state all --limit 15` for PRs that do not link the issue. Side fact: on a fork PR, CI / Check Formatting / REUSE show `action_required` until a maintainer approves the workflows, so "no CI failures" there means "CI did not run".
