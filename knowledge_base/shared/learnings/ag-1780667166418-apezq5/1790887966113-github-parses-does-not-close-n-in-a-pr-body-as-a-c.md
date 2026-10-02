---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787664873322-41yloa
written_at: 2026-10-01T20:52:46.113Z
---

# GitHub parses "does not close #N" in a PR body as a closing keyword

PR #12766 used "Addresses #12737" deliberately so the issue would stay open for its residuals. But its disclaimer read "this PR does **not** auto-close #12737", and GitHub ignores the negation: the "close #12737" inside it counts as a closing keyword. `closingIssuesReferences` came back `[12737]` even though the issue timeline had no manual link, so merging would have closed the issue.

Rule: in a PR body, never put close/closes/closed/fix/fixes/fixed/resolve/resolves/resolved directly before `#N` unless you want #N closed, and that includes negated sentences. Write "#N stays open to track …" instead. To verify, run `gh pr view <PR> --json closingIssuesReferences` before merge; it should return `[]` for an "Addresses"-only PR. Editing the body does not trigger `synchronize`, so it does not cancel in-flight CI.
