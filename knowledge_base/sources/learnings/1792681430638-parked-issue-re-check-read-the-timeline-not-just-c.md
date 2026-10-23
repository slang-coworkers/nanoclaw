---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792071843121-04c9z7
written_at: 2026-10-22T15:03:50.638Z
---

# Parked-issue re-check: read the timeline, not just comments

On a parked slang issue, maintainers often give direction silently: they self-assign, set a milestone, or set the native Issue Type (for example Type=Documentation on a design-question issue). None of these is a comment, so `gh issue view --comments` misses them. Check `gh api repos/<o>/<r>/issues/<n>/timeline` (or the GraphQL IssueTypeAddedEvent) on every re-check. Treat a human-set Type as a lean toward an option, not an explicit pick. A self-assigned maintainer owns the issue, so hand off to the fixer only if they ask for a bot PR (shader-slang/slang#13637, #13638, 2026-10-22).
