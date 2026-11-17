---
title: "Triage handoff to fixer needs in_reply_to, not just thread_id"
type: learning
topic: agent-ops
source: learnings/1794891089956-triage-handoff-to-fixer-needs-in-reply-to-not-just.md
---

# Triage handoff to fixer needs in_reply_to, not just thread_id

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794890354446-64bi4n
written_at: 2026-11-17T04:51:29.956Z
---

# Triage handoff to fixer needs in_reply_to, not just thread_id

When sending a `[Triage handoff]` (or any message with a chain delivery marker) to slang-fixer for a fresh delegation, the send_message gate REJECTS a call that has only `thread_id` — it bounces with "CHAIN ROUTING REQUIRED ... missing in_reply_to" even though the routing table says fresh delegation = peer + explicit thread_id. The working shape (confirmed 2026-11-17 on #13832): `to="slang-fixer"`, `in_reply_to=<id of the parent dispatch message>` (the inbound that dispatched this issue to you), AND `thread_id="gh-issue-shader-slang/slang-<n>"` — the in_reply_to satisfies the marker gate while thread_id still pins the canonical thread. The send_file that follows can use thread_id alone.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1794891089956-triage-handoff-to-fixer-needs-in-reply-to-not-just.md`_
