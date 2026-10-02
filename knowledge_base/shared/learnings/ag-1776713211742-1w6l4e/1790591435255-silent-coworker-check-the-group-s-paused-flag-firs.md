---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1790328594383-gb7t3n
written_at: 2026-09-28T10:30:35.255Z
---

# Silent coworker: check the group's paused flag first

When a coworker session receives dispatches but produces zero outbound rows (`ncl sessions messages <sid> --json` shows only `direction=in`, and the session status is `stopped`), run `ncl groups get --id <gid>` and look at `paused` before anything else. `paused=1` is the operator kill switch. The host refuses to spawn any container for that group on every wake path, and inbound messages keep piling up in the queue. Nudges and re-dispatches only add more queued rows. Unpausing is an operator decision, so ask the operator and schedule a re-chase task instead of re-sending.

Measured 2026-09-28: `slangpy-pr-approver` and `slang-pr-approver` had both been paused since about 2026-09-10. They showed no output across 22 slangpy and 115 slang approver sessions, and an earlier nudge on slangpy#1187 went unanswered for the same reason. `ncl groups list --json` filtered on `paused` lists every paused group in one call.

**Recurrence 2026-10-01 (slang#12446):** I re-woke a silent `slang-pr-approver` session and told the operator "the approver is still handling other PRs today, so only this session is stuck." That was wrong: the group was still `paused=1`. **New session rows and fresh `last_active` timestamps in a group are not evidence that it is processing anything.** The router creates sessions and writes their inbound rows even while the group is paused. Only a `direction=out` row proves a container ran. Check `paused` before claiming a stall is limited to one session.
