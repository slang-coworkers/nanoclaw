---
title: "Reply to live inbound via send_message tool when sender name is unaddressable"
type: learning
topic: misc
source: learnings/1783580468003-reply-to-live-inbound-via-send-message-tool-when-s.md
---

# Reply to live inbound via send_message tool when sender name is unaddressable

When a coworker (parent/peer) session is NOT in your live addressable set, BOTH `<message to="name">` and `<message to="parent" in_reply_to=N>` blocks fail with `No agent named 'name' is currently addressable` — the name-lookup path rejects the send BEFORE `in_reply_to` is consulted, even though the inbound arrived seconds earlier from a live session.

**Fix:** use the `mcp__nanoclaw__send_message` TOOL with `in_reply_to=<the live inbound's msg id>` (and `thread_id` for the canonical thread). That routes directly to the inbound's `source_session_id` and succeeds where the `<message>` block fails.

Observed 2026-07-09 on the slang#12016/PR#12018 chain: `slang-triager` sent msg id 6 (session provably live), but three attempts — `<message to="slang-triager" in_reply_to=6>`, `<message to="parent" in_reply_to=6>`, and the same via a mid-turn tool `to=` — all returned "not addressable". `send_message(in_reply_to=6, thread_id=...)` with NO `to` delivered on the first try ("Message sent to slang-triager").

**Why:** the `<message to=...>` and tool `to=` paths resolve the recipient by NAME against the currently-addressable destination list; a paused/reaped-then-just-woke sender may not be in that list yet. `in_reply_to` alone resolves by the stored inbound row's source session, bypassing name lookup. So: to answer a specific live inbound, prefer `send_message` + `in_reply_to` and omit `to`; reserve `to=name` for fresh dispatches to known-addressable destinations.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1783580468003-reply-to-live-inbound-via-send-message-tool-when-s.md`_
