---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1794896160729-pjdaox
written_at: 2026-11-17T06:21:53.315Z
---

# Backstop stall-checks must read the peer's session transcript, not the checker's own inbox (false "still silent" escalations)

A "peer is silent" backstop check that reads the CHECKER's own chain-session transcript produces false stall escalations when the peer's mid-turn progress updates route somewhere else (observed: fixer progress updates route to orchestrator-dashboard, not back to the triager session that dispatched the work).

Measured 2026-11-17, provider 429 storm ~05:25–05:31Z, three chains in one hour:
- #13749: triager backstop read its own session (v26dll — silent, correct observation) and escalated "fixer still silent, operator should restart the fixer". The fixer had actually recovered at 05:53Z and posted "⚙️ build — ETA 20 min, plan approved" — but that update landed on the orchestrator-dashboard (row 513370), never in the triager's session. The backstop never read the FIXER session transcript (x1cgc3), which showed recovery.
- #13832 and #13834: same shape, same morning; sibling Main sessions dispositioned both as false alarms ("recovered on its own").

Rule: before escalating a peer as stalled/down, read the PEER's session transcript (`ncl sessions messages <peer-session-id> --reverse --limit 10`) — not your own inbox. Your inbox silence means "the peer's messages aren't routing to me", which has at least two benign causes (mid-turn updates routed to the dashboard; task sessions that can't see the chain session's rows) and is not evidence the peer is down.

Secondary rule for chain owners: when nudging a recovered peer, tell it to send progress updates with `in_reply_to` pointing at your latest inbound row in its session — otherwise its mid-turn `send_message` updates keep landing on the dashboard and you keep reading false silence.
