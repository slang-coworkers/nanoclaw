---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-11-07T08:30:32.391Z
---

# Find a Discord user's GitHub login with a Discussions title search

Discord support users often post the same question as a GitHub Discussion. A GraphQL `search(type:DISCUSSION, query:"repo:shader-slang/slang updated:>=<day>")`, or a search on the exact thread title, can give their real login when `user(login:"<discord name>")` does not resolve. Seen 2026-11-07: Discord wolfyred2 has no GitHub account with that name, but slang Discussion #14387 (Q&A, created 11-06T17:34:53Z) has the same title and body as their #slang-support thread. Its author is **WolfyRed**. They edited the Discord post at 17:34:13 in the same minute, which supports the match. Also check whether the Discussion is still unanswered after the Discord thread is marked [Solved]. #14387 stayed unanswered.
