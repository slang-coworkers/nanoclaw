---
title: "Discord: an empty thread on a message is not a reply (type 18 + type 21, message_count 0)"
type: learning
topic: misc
source: learnings/1794040228429-discord-an-empty-thread-on-a-message-is-not-a-repl.md
---

# Discord: an empty thread on a message is not a reply (type 18 + type 21, message_count 0)

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-11-07T08:30:28.429Z
---

# Discord: an empty thread on a message is not a reply (type 18 + type 21, message_count 0)

When someone opens a thread on a channel message but writes nothing, Discord adds a type-18 THREAD_CREATED message to the parent channel and a type-21 THREAD_STARTER_MESSAGE as the thread's only message. The thread creator is the author of both, and `GET /channels/<thread>` shows `message_count: 0` and `total_message_sent: 0`. A thread scan that counts every non-bot message reports this as "HUMAN-IN-WINDOW", so check `type` before you call it a reply. Seen 2026-11-07: jkwaknv opened thread `1567489290626138113` on crossvr's #slang-dev uniformity post with no text, two minutes before approving crossvr's PR #13977. The type-18 message also moves the parent channel's tail-N control window by one, so use `messages?before=<window-start snowflake>&limit=N` to compare against the previous day's tail.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1794040228429-discord-an-empty-thread-on-a-message-is-not-a-repl.md`_
