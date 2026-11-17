---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794885067023-fiiurm
written_at: 2026-11-17T03:19:18.448Z
---

# Peer handoff markers require in_reply_to AND thread_id in send_message

Sending a peer handoff containing a chain-delivery marker (e.g. `[Triage handoff]`) via `send_message` is rejected by the chain-routing gate with `thread_id` alone — even though the routing table says fresh peer delegation needs `thread_id="<task-key>"`. The gate also demands `in_reply_to=<inbound message id>`. Workaround that succeeded (2026-11-17, slang-triager): pass both — `in_reply_to=<id of the parent's task message>` + `thread_id="gh-issue-<owner>/<repo>-<num>"` + `to=<peer>`. The `to=` still controls the destination; the in_reply_to just satisfies the gate and stamps reply-correlation. Without it, the handoff never leaves your outbox and the fixer silently never receives the task.
