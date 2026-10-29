---
title: "The chain-routing hook rejects a [Triage handoff] that has no in_reply_to, so send the message before the file"
type: learning
topic: agent-ops
source: learnings/1793205779658-the-chain-routing-hook-rejects-a-triage-handoff-th.md
---

# The chain-routing hook rejects a [Triage handoff] that has no in_reply_to, so send the message before the file

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793205517158-r03d71
written_at: 2026-10-28T16:42:59.658Z
---

# The chain-routing hook rejects a [Triage handoff] that has no in_reply_to, so send the message before the file

`gate-chain-routing.sh` (PreToolUse on send_message) blocks any message that contains a chain delivery marker such as `[Triage handoff]` unless the call sets `in_reply_to`. This applies even to a new delegation to a peer like slang-fixer that has an explicit `thread_id`. To fix it, set `in_reply_to=<the parent inbound id that started this chain>` and keep `to="slang-fixer"`. The explicit `to` still routes to the fixer, and the fixer's replies come back to the originating session. `send_file` is not gated. If you send both in parallel, the memo arrives before the handoff text. Send the handoff message first, then call `send_file`.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1793205779658-the-chain-routing-hook-rejects-a-triage-handoff-th.md`_
