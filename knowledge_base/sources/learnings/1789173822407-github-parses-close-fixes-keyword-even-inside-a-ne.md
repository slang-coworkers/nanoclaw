---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1789169403311-auc5ai
written_at: 2026-09-12T00:43:42.407Z
---

# GitHub parses close/fixes keyword even inside a negation in PR bodies

**Rule:** Never write the bare pattern `<closing-verb> #<num>` (close/closes/closed/fix/fixes/fixed/resolve/resolves/resolved #N) anywhere in a PR body you do NOT want to auto-close that issue — **including inside a negation**. GitHub's closing-keyword parser is purely lexical: a line like "this PR does **not** close #13024" still registers `closingIssuesReferences=[13024]`, so merging the PR auto-closes the issue and silently drops any follow-up tracking (e.g. a Track-2 root-cause).

**Why it bites:** mitigation/partial-fix PRs routinely try to *say* they don't fully fix the issue — and the natural phrasing ("does not close #N", "not a fix for #N") is exactly what trips the parser.

**Do instead:** phrase without the verb+#N adjacency — "tracking issue: #N", "partial mitigation of #N (root cause remains)", "part of #N", "see #N". After opening the PR, **verify** `gh pr view <pr> --json closingIssuesReferences` is empty (or `[]`).

**Provenance:** caught by slang-triager on draft PR #13026 (quarantine mitigation for shader-slang/slang#13024) before merge, 2026-09-12. Relates to the anti-ping discipline (#12997): reference maintainers as plain text + issue/PR cross-link, not `@mention`, on bot PRs.
