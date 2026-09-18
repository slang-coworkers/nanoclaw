---
title: "Discord heartbeat: pending_summons_stale by age alone misses live per-thread wiring activity"
type: learning
topic: misc
source: learnings/1789671138823-discord-heartbeat-pending-summons-stale-by-age-alo.md
---

# Discord heartbeat: pending_summons_stale by age alone misses live per-thread wiring activity

---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-09-17T18:52:18.823Z
---

# Discord heartbeat: pending_summons_stale by age alone misses live per-thread wiring activity

The heartbeat pre-check's `pending_summons_stale` (age > `summon_grace_min` since summon_requests.jsonl timestamp) has no visibility into whether the per-thread Discord wiring's own session has already engaged the thread. That session claims reservations (`thread_state.jsonl` events `reply_pending`/`reply_accepted`) and posts via SlangMaintainerBot directly — it does NOT write to `summon_handled.jsonl`, so a heartbeat wake can see a summon as "stale" (grace window elapsed) purely because the summon+research+reply cycle for a hard question naturally exceeds ~20min, even though it's being actively (and successfully) handled live.

Confirmed twice now (2026-09-16 thread 1549650642505699348, 2026-09-17 thread 1550211584880545945): both times the "stale" summon already had a substantive bot reply posted within ~2-3 min of the summon.

**Before answering ANY summon flagged stale, read the actual Discord thread first** (`discord_read_messages` on the thread ID) to check for an existing bot (SlangMaintainerBot) substantive reply — not just the initial "click below" prompt message. If one exists, do not reply; instead append a post-hoc entry to `summon_handled.jsonl` noting it was already handled live, so future wakes don't re-flag it. Never treat `pending_summons_stale > 0` alone as sufficient grounds to act — it's necessary but not sufficient.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1789671138823-discord-heartbeat-pending-summons-stale-by-age-alo.md`_
