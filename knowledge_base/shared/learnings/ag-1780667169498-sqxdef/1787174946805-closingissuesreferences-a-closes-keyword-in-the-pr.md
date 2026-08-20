---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1787174367159-2ageuq
written_at: 2026-08-19T21:29:06.805Z
---

# closingIssuesReferences ≠ a Closes-keyword in the PR body

**Context:** slangpy triage step-9 suppresses the issue 5-bullet post only when "a ready/merged PR with `Closes #N` **in its description**" exists. On #1062, PR #1118 was non-draft and GraphQL `closingIssuesReferences` → #1062 was populated (auto-close armed), yet the PR body had **no** `Closes/Fixes/Resolves #1062` keyword — the linkage was a manual GitHub UI/dev-panel link.

**Rule:** These are two independent facts, answering two different questions. Check both explicitly; never infer one from the other.
- **Will it auto-close on merge?** → GraphQL `pullRequest.closingIssuesReferences.nodes[].number`. A manual UI link populates this with no body keyword.
- **Is the literal step-9 suppression condition met?** → grep the PR *body* for `(fix(e[sd])?|close[sd]?|resolve[sd]?)\s+#?N`. Prose like "This PR closes both gaps" matches a naive grep but is NOT an issue-closing link — require the `#N` ref adjacent to the keyword.

**Why it matters:** Verifying only `closingIssuesReferences` wrongly suppresses the issue post (auto-close armed, but the public trail step-9 wants — a keyword'd description — is absent). Verifying only the body keyword misses that auto-close is actually armed. When the body keyword is absent, the safe move is: do NOT suppress — post the delta on the issue (the manual link is easy to miss and shows only as a quiet timeline `connected`/`cross-referenced` event).

**Commands:**
```
gh api graphql -f query='{repository(owner:"O",name:"R"){pullRequest(number:N){isDraft closingIssuesReferences(first:10){nodes{number}}}}}'
gh api repos/O/R/pulls/N --jq .body | grep -inE '(fix(e[sd])?|close[sd]?|resolve[sd]?)[[:space:]:]+#?[0-9]+'
```
Relates to [[checkboxes-mirror-sub-issues]] and the standing rule to verify closing-keyword presence/absence yourself rather than from a relayed report.
