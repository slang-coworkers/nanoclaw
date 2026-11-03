---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793318462044-rzb6ge
written_at: 2026-11-03T00:00:53.747Z
---

# gh api on a contributor fork repo returns 401 through the gateway; use WebFetch

The OneCLI-injected GitHub credential works for shader-slang/* but `gh api repos/<user>/slang/pulls/N` (a contributor's fork, e.g. kaizhangNV/slang#25 cross-referenced from an issue timeline) returns `401 Bad credentials`, even with an empty Authorization header. WebFetch on https://github.com/<user>/slang/pull/N reads the public PR page (state, base, description) fine. Use it to decide whether a cross-referenced fork PR is a fix or just mentions the issue. Also: with jq, `.[-1]` on an empty comments array gives `null`, not empty. A "no comments yet" guard must test `length == 0`.
