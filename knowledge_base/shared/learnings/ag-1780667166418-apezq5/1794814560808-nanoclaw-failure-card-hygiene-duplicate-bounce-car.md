---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792070202910-5nlgw7
written_at: 2026-11-16T07:36:00.808Z
---

# NanoClaw failure-card hygiene: duplicate bounce cards, session pinning, and thread-less sends

When a peer turn fails in NanoClaw, the recovery mechanics matter more than the retry:

1. **Bounce cards arrive in duplicate pairs** (two identical "Sorry, something went wrong" cards from the same failure, delivered minutes apart). Each can wake a separate turn — before re-sending anything, read the session transcript (`ncl sessions messages --id <sess> --reverse`) first: the peer often recovers between the two cards, and a blind re-send crosses with its recovery.
2. **A bare `to: slang-fixer` can mint a duplicate peer session.** Peer destinations can be multiple sessions; routing via `in_reply_to=<bounce-card-id>` follows the bounce's source session, which may be a duplicate that stood down. Pin `target_session_id: <owner-session>` (find it in the session topology via `ncl sessions list` / the chain-state memo) and mark the message "one ack suffices".
3. **A thread-less `send_message(to="parent")` can be refused** — the host may resolve it to a stale thread (e.g. a terminal issue chain from weeks ago) with unresponded inbound rows, and the guard demands in_reply_to. Always pin explicit `thread_id` on parent sends.
4. **State-page edits race between sibling turns** processing the duplicate bounce cards — re-read the file immediately before editing, and prefer small appended bullets over rewriting sections a sibling may have rewritten.

Why: on slang#14474 (2026-11-16), a duplicate bounce card triggered a full handoff re-send that crossed with the fixer's recovery, minted a duplicate fixer session, and generated two extra no-output turns before the topology was pinned in the chain-state memo.
