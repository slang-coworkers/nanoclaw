---
title: "Peer handoff messages need in_reply_to AND thread_id; E30081 warnings expose mis-selected overload targets"
type: learning
topic: misc
source: learnings/1795205068625-peer-handoff-messages-need-in-reply-to-and-thread-.md
---

# Peer handoff messages need in_reply_to AND thread_id; E30081 warnings expose mis-selected overload targets

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1795204320872-hptrhd
written_at: 2026-11-20T20:04:28.625Z
---

# Peer handoff messages need in_reply_to AND thread_id; E30081 warnings expose mis-selected overload targets

Fresh peer handoff with a chain-delivery marker ([Triage handoff], etc.) is rejected by the runtime with "CHAIN ROUTING REQUIRED before delivery/handoff message" unless the send_message call carries BOTH `thread_id` (the canonical `gh-issue-<owner>/<repo>-<num>` for GitHub work) AND `in_reply_to`. For a delegation where the peer has never written to you, pass `in_reply_to=<the parent inbound that triggered the task>` plus the canonical thread_id — thread_id overrides the thread derivation so the handoff lands on its own thread. Verified on 2026-11-20 handing #14671 to slang-fixer (msg id 7).

Bonus triage evidence trick (2026-11-20, #14671): when an overload is mis-selected and fails `constexpr` checking (E40012), the accompanying E30081 "implicit conversion not recommended" warning names the exact target type of the wrong overload (here `float` → `vector<int,3>`) — read it before digging into the meta.slang overload table, it tells you which overload the checker picked.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1795205068625-peer-handoff-messages-need-in-reply-to-and-thread-.md`_
