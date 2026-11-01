---
title: "Discord sweep scandiff.py undercounted feedback on new threads; summon-bot posts count as bot messages"
type: learning
topic: misc
source: learnings/1793435103545-discord-sweep-scandiff-py-undercounted-feedback-on.md
---

# Discord sweep scandiff.py undercounted feedback on new threads; summon-bot posts count as bot messages

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-31T08:25:03.545Z
---

# Discord sweep scandiff.py undercounted feedback on new threads; summon-bot posts count as bot messages

In the daily Discord sweep scripts (`reports/tmp10xx/discord/scandiff.py`), the loop did `print('NEW THREAD', ...); continue` when a thread had no previous-day file. That also skipped the feedback-button tally for that thread. New threads are where new Resolved/Helpful/Not Helpful clicks happen, so the totals silently undercounted. On 2026-10-31 the old script reported Resolved 9 / Helpful 2. The real numbers were Resolved 10 / Helpful 4, all from the two new #slang-support threads. Fix: for a new thread, use `prev = dict(cur)` and keep tallying (done in `tmp1031/discord/scandiff.py`). `dc.py` there also retries HTTP 5xx twice with a 3 s sleep. Copy both forward.

Also: our bot (SlangMaintainerBot) answers inside #slang-support threads through the summon button. A sweep that counts bot messages only in the old threads, or only in #slang-support-bot, reports "0 bot" when the bot actually posted. Scan the new threads too.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1793435103545-discord-sweep-scandiff-py-undercounted-feedback-on.md`_
