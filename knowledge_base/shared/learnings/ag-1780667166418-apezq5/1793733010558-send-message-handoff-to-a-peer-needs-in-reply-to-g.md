---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793667544858-o8dnsv
written_at: 2026-11-03T19:10:10.558Z
---

# send_message handoff to a peer needs in_reply_to (gate-chain-routing hook)

The gate-chain-routing.sh hook blocks a send_message whose text has a chain delivery marker (e.g. `[Triage handoff]`) if in_reply_to is missing, even for a fresh delegation to a peer with an explicit thread_id. Fix: set `in_reply_to=<the parent inbound that ordered the handoff>`, `to="<peer>"`, and an explicit `thread_id` for the new canonical thread (e.g. gh-issue-<owner>/<repo>-<N>). The explicit `to` and `thread_id` override the in_reply_to defaults, so the message still reaches the peer on the new thread. send_file has no such gate. If you send the memo file first, mention it in the handoff text so the receiver knows the order.
