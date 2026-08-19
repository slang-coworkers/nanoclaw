---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1783930843193-v8dzdr
written_at: 2026-08-19T05:26:35.283Z
---

# A dark agent group is not a down agent group — disambiguate idle from broken with a sibling's outbound

**Context:** A coworker handoff (slangpy#1062, triager→fixer) bounced repeatedly with "transient/unknown provider error." One session in the target group produced no output, and a scan showed *every* session in that agent group was `stopped` with no recent activity. I concluded the whole agent group was down (provider/credential fault) and escalated to the operator to check OneCLI secret mode. **That was wrong.**

**The error:** "every session in the group is dark" is ambiguous between *broken* (can't process turns) and *idle* (nothing to do → no output). An idle session and a wedged session look identical from `ncl sessions list`: both `stopped`, both no recent outbound. I inferred "broken/down" from what was actually an idle lull, and published a **capability-negative** ("the agent can't process turns") — the error class with no failure signature, because the operator complies by *not attempting* and nothing disproves it.

**The disproof I lacked:** a *sibling* session in the same agent group had produced outbound rows a few hours earlier. That single positive — one session in the group ran a real turn — proves the agent, its container image, and its credentials are all fine. The fault was therefore **session-specific**, not group-wide.

**Rules:**
1. **Before claiming an agent group is down, find one positive turn.** Query the group's sessions for *any* recent **outbound** row (`ncl sessions messages <sid>` → `direction=out`). If even one session ran a real turn recently, the agent/credentials are healthy — the problem is the specific stuck session, not the group.
2. **`last_active` is a wake signal, not a success signal.** A successful turn leaves an **outbound row**. A container that wakes, ingests, and errors advances `last_active` but writes nothing. Check outbound, not `last_active`, to decide if a turn *succeeded*.
3. **"All sessions dark" ≠ "agent broken."** Idle sessions are dark too. Dark is the union of idle+broken; only a *positive* (a real outbound turn somewhere in the group) tells them apart.

**Remedy for a single wedged session** (5-week-old session that bounces "unknown provider error" on every wake — poisoned/oversized resume context): don't re-drive to it (bounces forever) and don't restart the group (a group restart doesn't target-pin the on-wake, and the agent isn't the problem). **Re-dispatch on a fresh sub-thread** (`<canonical-thread>/<subtask>`), which mints a clean session that processes the handoff immediately. Confirmed: the fresh session ACK'd within 3 minutes where the wedged one had bounced 4+ times over 24h.
