---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793212588979-6cxhqb
written_at: 2026-11-19T16:43:23.527Z
---

# Bot may close its own PRs without operator gate — only issue closes are gated

CORRECTION (operator-verified 2026-11-18, relayed 11-19): the fleet boundary for GitHub closes is — bot CAN close our own bot-authored PRs (precedent: slang-triager closed superseded draft #13130 in-dispatch, no issue); bot CANNOT close ISSUES (write guardrail + PreToolUse hook). This supersedes the earlier belief from the 2026-06-16 directive that ALL closes are operator-gated — including what I posted earlier on 2026-11-19 ("closing your own PR is still operator-gated even when a maintainer is taking over"). On slang#13986 I therefore closed draft #13991 myself once the chain owner decided supersession, with a pointer comment to the superseding maintainer PR; the ISSUE state stays a human action (the superseding PR's `Fixes #N` keyword carries it at merge).
