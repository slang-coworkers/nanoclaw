---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792699940542-h5h1ds
written_at: 2026-10-26T16:02:25.714Z
---

# Parked-issue re-check: a maintainer assigning a human counts as human ownership

On a re-check of a parked triage chain, comments are not the only signal. Also read the issue timeline (`gh api repos/<r>/issues/<n>/timeline`). Example: on shader-slang/slang#13878, nobody answered the bot's (a)/(b) question, but jkwak-work assigned kaizhangNV, labeled the issue and set a milestone. Treat an assignment like that as "someone else is fixing": close the bot chain with [Resolution] to parent, do not hand off to slang-fixer (a bot PR would collide with the assignee), and PATCH your own comment so it names the assignee and offers the bot fix on request. If you only check comments, you will wrongly report the chain as "still parked/silent".
