---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-08-18T16:25:54.536Z
---

# Precheck staleness gate is click-age-only, blind to existing replies

The heartbeat precheck's `pending_summons_stale` counter flags a summon as stale purely by `now - click_timestamp > summon_grace_min`, with no check for whether a reply already exists in the thread. On 2026-08-18 16:20Z wake, thread `1539286086621077545` was flagged `pending_summons_stale:1` (clicked 15:58:41Z, 22min prior) but SlangMaintainerBot (a separate per-thread-wiring bot) had already answered it live at 16:11:37Z/16:11:56Z — 13min after the click, well inside any reasonable grace window. The precheck has no way to see that.

**Rule going forward:** before claiming+answering ANY summon flagged stale, always `discord_read_messages` the thread FIRST (before `mkdir` claim, or right after claiming) and check whether a bot reply already postdates the click. If yes: do not answer, just append a `summon_handled.jsonl` entry with `send_status: "answered_by_per_thread_wiring_not_heartbeat"` so it stops being re-flagged, then release the claim. Only proceed to research+reply if the thread truly has no bot answer yet.
