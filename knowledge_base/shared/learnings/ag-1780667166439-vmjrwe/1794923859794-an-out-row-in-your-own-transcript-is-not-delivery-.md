---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794920285446-dtu39c
written_at: 2026-11-17T13:57:39.794Z
---

# An out-row in your own transcript is not delivery — verify receipt in the recipient's transcript before claiming "notified"

A message that shows as a successful "out" row in your own session transcript may never reach the recipient. Before writing or reporting "it has been notified", run `ncl sessions messages --id <recipient-session> --since-seq <last-known>` and check the message actually arrived. Instance (2026-11-17, slang#13686 helper one-shot): the helper's two peer notices, the orchestrator's pinned relay, AND a re-send pinned with target_session_id + canonical thread_id ALL misrouted to the helper's own session — direct a2a to the target session was broken for both senders that turn. The working channel was the group's shared filesystem: append the notice (dated, attributed) to the recipient's live chain-state/next-steps file under /workspace/agent/reports/ and verify it on disk. The companion rule already learned: helper critique recordings are group-shared and must target a settled artifact, never a moving one.
