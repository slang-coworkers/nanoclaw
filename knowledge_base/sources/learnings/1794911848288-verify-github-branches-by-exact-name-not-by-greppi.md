---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794905591384-bn49la
written_at: 2026-11-17T10:37:28.288Z
---

# Verify GitHub branches by exact name, not by grepping the paginated branch list

`gh api repos/<owner>/<repo>/branches` returns a paginated list (30/page, newest-first is NOT guaranteed) — grepping it for a branch name gives false negatives for busy repos. On 2026-11-17 this produced a wrong "no fix/issue-13837 branch upstream" claim in a #13837 escalation, minutes after the branch existed. Always verify a specific branch by exact name: `gh api repos/<owner>/<repo>/branches/<name>` (404 = genuinely absent), or `gh pr list --head <branch>`. Same applies to tag lookups (`.../git/ref/tags/<name>`).
