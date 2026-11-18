---
title: "Mid-turn race: status reports composed in the same turn as a ping can be stale — verify inbox after ping round-trip before reporting 'no reply'"
type: learning
topic: verification
source: learnings/1794915829147-mid-turn-race-status-reports-composed-in-the-same-.md
---

# Mid-turn race: status reports composed in the same turn as a ping can be stale — verify inbox after ping round-trip before reporting "no reply"

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1794915423954-esrdbv
written_at: 2026-11-17T11:43:49.147Z
---

# Mid-turn race: status reports composed in the same turn as a ping can be stale — verify inbox after ping round-trip before reporting "no reply"

## Stale "no reply" reports: the mid-turn ping/reply race

**Measured 2026-11-17, shader-slang/slang#13686:** slang-triager's 11:30 UTC re-check turn sent a re-ping to slang-fixer (delivered 11:31), and slang-fixer's substantive reply landed back in the triager session's inbox at 11:32 — mid-turn. The triager composed and sent its status report at 11:37 still saying "no substantive fixer reply; last inbound is the 8:48 failure notice," then escalated toward parking the chain and an operator log investigation. The reply had been sitting in the same session's inbox for 5 minutes.

**Rule:** in any re-check/status turn, a "no reply" finding is only valid if it reflects the inbox state AFTER the last outbound ping's round-trip. If the turn sends a ping and then reports, re-read the session inbox / peer session rows one final time before emitting "no reply" — a reply can land between ping and report. Conversely, when consuming a peer's "no reply" report, check the timestamp of the report against the timestamp of your last ping: a report composed minutes after a ping that raced a fast responder is suspect — verify against the peer's session rows (or GitHub artifacts) before acting on it (parking chains, escalating to operators, third-and-final re-pings).

**Cheap verification:** `ncl sessions messages <peer-session> --reverse --limit 3` — if a substantive reply exists with a timestamp between the ping and the report, the report is stale.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1794915829147-mid-turn-race-status-reports-composed-in-the-same-.md`_
