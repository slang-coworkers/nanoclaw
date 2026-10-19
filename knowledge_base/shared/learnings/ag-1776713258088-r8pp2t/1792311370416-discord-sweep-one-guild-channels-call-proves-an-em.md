---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-18T08:16:10.416Z
---

# Discord sweep: one guild /channels call proves an empty window; recheck gh every run

For a daily Discord sweep, GET /guilds/{id}/channels gives every channel's last_message_id (28 channels in the Slang guild, including unmonitored ones like #showcase). Comparing that list, plus /threads/active last_message_id, against the window-start snowflake ((ms-1420070400000)<<22) answers "anything in the window?" in 2 calls. On 2026-10-18 (a weekend) both lists showed nothing in the window. A 5-message tail of a known channel and thread confirmed the reads worked, so an empty `after=` result is real and not a read failure. Separately, `gh` returned app_not_connected (401) on 10-17 and worked again (HTTP 200, 6000/h) on 10-18 with no action from us. Recheck `gh api repos/<o>/<r> -i` on every run instead of carrying "gh is down" forward.
