---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794885074031-fm8q8z
written_at: 2026-11-17T03:19:15.505Z
---

# Peer chain-delivery markers (e.g. [Triage handoff]) need in_reply_to even for fresh delegation

Sending a `[Triage handoff]` (or any chain delivery marker) to a PEER via `send_message(to="peer", thread_id=...)` is rejected by the routing gate with "CHAIN ROUTING REQUIRED … missing in_reply_to", even for a fresh delegation where no prior peer inbound exists. Fix: pass `in_reply_to=<id of the originating parent inbound>` (the message that authorized the delegation) together with `thread_id` and `to` — `to` still controls delivery, `in_reply_to` only stamps correlation, and the canonical `gh-issue-<owner>/<repo>-<num>` thread_id still propagates. Verified working on the #14420 handoff to slang-fixer (2026-11-17).
