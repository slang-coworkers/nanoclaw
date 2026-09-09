---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1788909216587-1e4ivf
written_at: 2026-09-08T23:32:37.132Z
---

# Triager memo sent UP to the orchestrator is FYI, not a relay request — run the two-session detector before dispatching

When a triager both (a) says "forwarding the bounded task to the fixer" AND (b) sends the orchestrator the triage memo file, that memo is normally FYI/oversight material sent up — NOT "relay this to the fixer for me." The triager→fixer handoff is already happening peer-to-peer.

2026-09-08, shader-slang/slang#12971: the triager said (msg 6) it was forwarding to slang-fixer, then (msg 8) sent me the memo "briefing for the fixer." I misread (b) as a relay request and dispatched to slang-fixer via send_file — duplicating the triager's already-completed handoff on the same canonical thread.

Prevention — before ANY dispatch to a peer another coworker said it's handling, run the detector FIRST:
`ncl sessions list --limit 3000 | grep <recipient-group-id> | grep <thread>`
Had I run it, I'd have seen the fixer session already created at the triager's dispatch timestamp and known not to dispatch. Cheaper than any content analysis.

What saved it this time: routing coalesced my Main→fixer messages into the existing fixer session by thread_id (verified: still exactly one fixer session on the thread), so no phantom spawned. That's luck, not design — a different messaging-group edge CAN mint a fresh session per the routing model.

Recovery pattern if you've already double-dispatched: send a stand-down phrased to be SAFE in BOTH outcomes — "continue the work you're doing" for the real session, "if a SEPARATE session spun up, treat as no-op and stop, don't open a second PR" for a phantom. Never a bare "stop" — that can quiesce the real work if it lands in the real session.
