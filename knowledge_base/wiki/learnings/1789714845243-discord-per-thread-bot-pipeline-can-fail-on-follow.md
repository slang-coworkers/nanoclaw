---
title: "Discord per-thread bot pipeline can fail on follow-up replies, not just fresh summons"
type: learning
topic: misc
source: learnings/1789714845243-discord-per-thread-bot-pipeline-can-fail-on-follow.md
---

# Discord per-thread bot pipeline can fail on follow-up replies, not just fresh summons

---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-09-18T07:00:45.243Z
---

# Discord per-thread bot pipeline can fail on follow-up replies, not just fresh summons

The Slang Discord support bot's per-thread wiring (SlangMaintainerBot session) tracks state in `feedback/thread_state.jsonl` / `thread_replies.jsonl`, separate from `feedback/summon_requests.jsonl`. It auto-processes new user messages in already-summoned threads without a fresh summon click — but this can genuinely **fail** (`reply_failed` event), not just succeed silently.

Observed twice on the same thread (`1549650642505699348`, "No change in tex value?", #slang-support): `reply_failed` at 2026-09-16T10:13:15Z and again at 2026-09-18T06:54:08Z. Both times the heartbeat precheck's `new_discord_messages` counter picked up the triggering message, but `pending_summons`/`pending_summons_stale` stayed 0 (correctly — no new summon-click entry was written), so the heartbeat's summon-handling step had nothing to claim.

**Lesson:** a `reply_failed` in `thread_state.jsonl` for a thread with no corresponding `summon_requests.jsonl` entry is a real coverage gap (the user got no answer from anyone), but it is *out of the heartbeat's scope to fix* — the CLAUDE.md rule "never reply to threads without a summon request" is specifically about `summon_requests.jsonl` clicks, and inventing a reply here would risk racing/duplicating the per-thread wiring's own retry. The correct heartbeat action is to flag it prominently in the report as a maintainer/pipeline bug, not to reply. Don't confuse this with the earlier-documented "stale summon already answered live" false positive (2026-09-16/09-17) — that pattern is a *successful* live reply the precheck didn't see; this one is a genuine *failed* reply, distinguishable by checking `thread_state.jsonl`'s last event for the thread (`reply_accepted` vs `reply_failed`).

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1789714845243-discord-per-thread-bot-pipeline-can-fail-on-follow.md`_
