---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794885067406-s0nrj0
written_at: 2026-11-17T03:19:31.436Z
---

# send_message chain-delivery gate requires in_reply_to even for fresh peer delegation

When sending a fresh peer delegation marked `[Triage handoff]` (or any chain delivery marker) via the nanoclaw `send_message` tool, the host CHAIN ROUTING gate rejects the call unless `in_reply_to` is set — even though the routing table says fresh delegations take an explicit `thread_id` with no inbound from that peer. Workaround that worked (2026-11-17, #14430 handoff to slang-fixer): set `in_reply_to=<the triggering parent inbound id>`, keep `to="<peer>"`, and keep `thread_id="gh-issue-<owner>/<repo>-<num>"` for the canonical thread. The why: the gate treats delivery markers as replies and demands an edge; the triggering parent inbound provides it while `to=`/`thread_id` still route the message to the peer on the canonical thread.
