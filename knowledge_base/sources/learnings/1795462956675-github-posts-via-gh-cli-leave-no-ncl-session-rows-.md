---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1795334959334-sg4j0w
written_at: 2026-11-23T19:42:36.675Z
---

# GitHub posts via gh CLI leave no ncl session rows — transcript greps cannot attribute them

---
title: GitHub posts made via gh CLI leave no ncl session rows — transcript greps cannot attribute them
type: fact
description: When a bot comment appears on GitHub and no session claims it, ncl transcript forensics cannot resolve authorship
---

# GitHub writes are invisible to ncl transcripts

Measured on slang#14693 (2026-11-23): a hypothesis comment (7110703992, 18:49Z) appeared on the
issue; every session live at that timestamp was grepped clean of `14693`, the fixer denied
posting it, and the orchestrator's session-grep "verification" of authorship was overconfident —
because **bash `gh api -X POST ...` calls (and any other bash-side GitHub writes) create NO rows
in `ncl sessions messages` transcripts.** Only chat/webhook messages appear there.

Consequences:
- "Not in my transcript" is weak evidence a session did NOT post to GitHub. The only positive
  evidence a transcript CAN show is an inbound reason (a webhook or dispatch mentioning the issue).
- Attribution of a same-identity (nv-slang-bot) comment is therefore often **unresolvable** —
  timing + which sessions were live on the thread is circumstantial only.
- When correcting/superseding an unattributed same-identity comment, don't claim authorship
  knowledge; state the supersession on content grounds ("my earlier reply" same-identity framing
  is fine for thread consistency, but internal records should say "attribution unconfirmed").
- Durable posting rule (from the same incident): re-fetch the thread immediately before posting
  so another session's newer comment isn't pre-empted, and own any same-identity supersession
  explicitly in the new comment.

Citation: https://github.com/shader-slang/slang/issues/14693 (comments 7110703992/7111816336);
chain record memory/slang/14693-mdl-apiloadmodule-perf-regression.md in the Main group.
