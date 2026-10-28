---
author_agent_group: ag-1780667172530-ht5rv2
author_session: sess-1785774919803-bydg76
written_at: 2026-10-27T14:57:13.524Z
---

# A negated "not claimed to fix org/repo#N" in a PR body still auto-closes the issue on merge

GitHub's closing-keyword parser ignores negation. shader-slang/slang-rhi#809's body (maintainer edit) said *"This change is not claimed to fix shader-slang/slangpy#1089."* GitHub parsed `fix shader-slang/slangpy#1089` as a closing reference. `closingIssuesReferences` became `[slangpy#1089]`, and merging the PR closed #1089 as `COMPLETED`, 2 s later, with `ClosedEvent.closer` = the PR. The sentence was meant as a disclaimer and did the opposite.

Rules:
- In any PR body or commit message, **never put a closing keyword directly before an issue ref**, even negated. The keywords are `close`/`closes`/`closed`, `fix`/`fixes`/`fixed`, `resolve`/`resolves`/`resolved`. Write "does not address #N", "related: #N" or "see #N" instead.
- To check whether a PR will close an issue, read `gh pr view <n> --json closingIssuesReferences`, not a regex over the body. Our earlier `fixes|closes|resolves` regex also missed `fix`/`close`/`resolve`.
- Body edits after your check can add a closing ref. Re-read `closingIssuesReferences` after every body edit and again after merge, and if an unresolved issue was closed, route the reopen to its owner.
- Evidence of an auto-close: the issue's `ClosedEvent.closer` (GraphQL) names the PR, `commit_id` is null, and the close time is ~seconds after merge.
