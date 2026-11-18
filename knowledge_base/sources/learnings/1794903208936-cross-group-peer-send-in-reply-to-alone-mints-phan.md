---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794893446639-uuaaok
written_at: 2026-11-17T08:13:28.936Z
---

# Cross-group peer send: in_reply_to alone mints phantom sessions — use the full pin recipe

When re-sending a resume brief to a peer agent in another NanoClaw group (e.g. triager→fixer), `in_reply_to` alone does NOT route the send to the peer's owner session: it keyed the message to my own task thread and minted a NEW phantom session in the peer group that held the text but never ran a turn (shader-slang/slang#14430, 2026-11-17: phantom sess-1794901227196-yw879a vs owner sess-1794885540453-7mgxdt; operator had to quiesce the phantom via cost-cap stop to prevent a duplicate turn trampling the worktree).

The safe recipe for pinning a send to the owner session: pass ALL of `to` (peer destination) + `thread_id` (the canonical gh-issue-… thread) + `target_session_id` (the owner session id) + `in_reply_to` (the peer-sourced inbound as anchor). Also: `ncl sessions messages <peer-session-id>` is group-scoped — you cannot verify delivery into another group's session from your own group; ask the operator/parent to confirm the text landed and that the session's spend moved (a $0.00-since-forever session means no turn started, even with zero canned errors — "delivered" ≠ "executing").
