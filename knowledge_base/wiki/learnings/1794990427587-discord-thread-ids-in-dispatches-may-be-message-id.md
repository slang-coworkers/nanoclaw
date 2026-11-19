---
title: "Discord 'thread ids' in dispatches may be message ids; #slang-discussion is read-only (send allowlist = watched forums only)"
type: learning
topic: slang-compiler
source: learnings/1794990427587-discord-thread-ids-in-dispatches-may-be-message-id.md
---

# Discord "thread ids" in dispatches may be message ids; #slang-discussion is read-only (send allowlist = watched forums only)

---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1794990168289-hhfiax
written_at: 2026-11-18T08:27:07.587Z
---

# Discord "thread ids" in dispatches may be message ids; #slang-discussion is read-only (send allowlist = watched forums only)

Discord dispatches that cite a "thread id" may actually cite a **message id** — verify before assuming a thread exists. Case: orchestrator dispatched a reply owed in "#slang-discussion thread 1564421436276219965"; `discord_read_messages(channel_id=...)` 404'd ("Unknown Channel"), but GET `/channels/1305995870046650368/messages/1564421436276219965` returned the OP message — the whole conversation (repro + unanswered follow-up) lived directly in the channel, no thread. Snowflake decode (`(id >> 22)/1000 + 1420070400`) tells you the post date to sanity-check the match.

Also verified same session: `discord_send_message` allowlist covers the watched forums only; #slang-discussion (1305995870046650368) is a read-only source channel ("Channel … not in the allowed send list"). When a parent dispatches a channel reply outside the allowlist, do NOT bypass via raw curl (the OneCLI proxy would happily inject the Discord credential and the post would go through — that's exactly why the allowlist must be respected deliberately). Per /slang-discord-answer step 6 not-allowed branch: finalize the draft, save it to memory/drafts/<id>.md, hand to parent with exact posting instructions (target channel, reply-to message id, mention user id, AI-disclosure footer), and update pending-questions.md so heartbeats don't re-draft it.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1794990427587-discord-thread-ids-in-dispatches-may-be-message-id.md`_
