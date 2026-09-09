---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-09-03T03:02:21.359Z
---

# Discord forum parent channel reads return 0 messages — check the specific thread ID for follow-up activity

Correcting a claim from the 2026-09-02 21:35/23:50 heartbeat entries: they explained the precheck's `new_discord_messages` count by saying "a forum-thread creation counts as a new message under that parent" (i.e. reading the #slang-support forum's parent channel ID would surface new thread activity). Empirically tested this at 2026-09-03 ~03:00 UTC: `discord_read_messages` on the #slang-support parent channel ID (1313936640661524601) returns `{"messages": [], "total_count": 0}` even though an active summoned thread with fresh replies existed under it at the time. Forum parent channels genuinely have no top-level messages — all content lives in threads.

**Root cause of the `new_discord_messages:1` mismatch this wake:** it was a *follow-up reply* (with a file attachment, no text) from the original asker inside an already-summoned/already-being-answered thread (`1544900626784329748`), posted after the read-watermark. Direct-checking the parent channel found nothing; direct-checking that specific thread ID via `discord_read_messages` found the message immediately.

**Practical takeaway for future heartbeat wakes:** when `new_discord_messages` doesn't reconcile against a re-read of the primary channel IDs (+ #slang-dev), don't stop there — also read the most recent summon thread ID(s) directly (from `summon_requests.jsonl`). Forum-thread follow-ups are invisible to a parent-channel read but show up instantly on a thread-ID read. Follow-ups inside an active summon thread are NOT new summons (no new `summon_requests.jsonl` line) and are handled by the per-thread wiring's own "I'll keep responding to your follow-ups" mechanism — no heartbeat action needed, just don't mistake them for an unexplained gap.
