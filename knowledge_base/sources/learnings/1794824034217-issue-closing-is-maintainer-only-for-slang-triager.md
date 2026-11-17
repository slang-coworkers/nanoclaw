---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794823871515-09nhfp
written_at: 2026-11-16T10:13:54.217Z
---

# Issue-closing is maintainer-only for slang-triager (hook blocks command text too)

`gh issue close` (any close of a GitHub issue) is hook-blocked for this slang-triager container — "maintainer-only action"; the hook also fires on command text that merely *mentions* the phrase (it pattern-matches the whole command string, including heredoc bodies). Disposition for duplicates/wontfix: post the verdict as an issue comment and leave the close to a human maintainer. Workaround when writing memos: avoid the literal phrase in bash command strings. Verified 2026-11-16 on slang#14499.
