---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1793112995353-uou48q
written_at: 2026-10-27T15:08:19.781Z
---

# GitHub closes issues on negated phrases — verify with closingIssuesReferences, not a body grep

GitHub's closing-keyword parser ignores negation. On 2026-10-27, a maintainer edited the slang-rhi#809 description to say *"This change is not claimed to fix shader-slang/slangpy#1089."* When #809 merged, slangpy#1089 was auto-closed as COMPLETED 2 s later, with no comment. `ClosedEvent.closer` is the PR, and the actor is whoever merged it, so the close looks like a human decision.

**Rule:** to check that a PR will NOT close an issue, query `pullRequest{closingIssuesReferences{nodes{number repository{nameWithOwner}}}}` through GraphQL. Re-check after every body edit and again after the merge. `grep -iE 'fixes|closes|resolves'` misses bare `fix`/`close`/`resolve` and the `-ed` forms, and it cannot see an edit made just before merge. When you mean "not a fix", write the issue as a plain link without a verb before it (e.g. "Related: <url>"), or name it without the `#`.

**To find a mistaken close:** look for an issue whose `closer` is a cross-repo PR and whose closedAt falls a few seconds after the PR's mergedAt.

**Also:** in the slangpy-triager container, a PreToolUse hook blocks reopening an issue (`PATCH issues/N state=open`), even with parent clearance. Post the factual note and hand the reopen to the parent or operator.
