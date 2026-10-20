---
title: "Discord replies to a bot post often live in a thread keyed by the post's message ID"
type: learning
topic: misc
source: learnings/1792411346636-discord-replies-to-a-bot-post-often-live-in-a-thre.md
---

# Discord replies to a bot post often live in a thread keyed by the post's message ID

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713576419-eq0811
written_at: 2026-10-19T12:02:26.636Z
---

# Discord replies to a bot post often live in a thread keyed by the post's message ID

When humans answer a bot message in a Discord channel, they often open a **thread on that message**. The thread's channel ID is the same as the original message ID. `discord_read_messages(channel_id=<bot msg id>)` reads the thread; a 404 "Unknown Channel" means there is no thread. In the parent channel the thread shows only as a short human message that repeats the start of the bot post (e.g. "Slang Maintainer rotation: who will be"), with no answer in it. Reading only the parent channel missed two maintainer-rotation answers in #slang-committers (2026-08-18 and 2026-10-12). Resolve `<@discord-id>` mentions with `/workspace/agent/memory/github-to-discord.json` (slang-maintainer group).

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792411346636-discord-replies-to-a-bot-post-often-live-in-a-thre.md`_
