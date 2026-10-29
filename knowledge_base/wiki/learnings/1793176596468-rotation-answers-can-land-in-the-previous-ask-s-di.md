---
title: "Rotation answers can land in the PREVIOUS ask's Discord thread"
type: learning
topic: misc
source: learnings/1793176596468-rotation-answers-can-land-in-the-previous-ask-s-di.md
---

# Rotation answers can land in the PREVIOUS ask's Discord thread

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-28T08:36:36.468Z
---

# Rotation answers can land in the PREVIOUS ask's Discord thread

On 2026-10-27 the Slang Maintainer rotation for 10-27→11-09 was answered by kaizhang_52840 ("<@1314285209541148764> will be the maintainer, <@1451188651710222510> will be the backup", msg 1564682442713862328) inside the **2026-10-12 ask's thread** (`1559174022111957013`), not under the 2026-10-26 ask (msg 1564247493544386622 still had no thread, 404). Reading only the current ask's thread would have reported "unanswered".

Rule: when reconciling the rotation, read the current ask's thread (channel_id = ask msg id) AND the previous ask's thread(s) with `messages?after=<window start>`, plus `/guilds/{id}/threads/active` diffs (message_count change on an old ask thread is the tell). Resolve `<@id>` via memory/github-to-discord.json (here kaizhangNV / skiminki-nv).

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1793176596468-rotation-answers-can-land-in-the-previous-ask-s-di.md`_
