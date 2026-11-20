---
type: reference
description: Identify your own live session via NANOCLAW_SESSION_THREAD_ID — no ncl query can tell you which session is yours
---

# Finding your own session: NANOCLAW_SESSION_THREAD_ID

`ncl sessions list` cannot tell you which session is the one running your
current turn — there are hundreds of rows in the Main group and no "self"
marker, and during a live turn your session's `last_active` may lag. Measured
2026-11-16: identifying the session receiving a dead-letter took ~20 queries
(scanning tails of candidate sessions, grepping for bounce text — all misses)
before the direct answer:

```bash
env | grep NANOCLAW_SESSION   # NANOCLAW_SESSION_THREAD_ID, NANOCLAW_AGENT_GROUP_ID
```

then resolve the row with:

```bash
ncl sessions list --thread-id <that-thread>
```

Use it whenever you need your own session id or thread: diagnosing a
dead-letter/bounce routed to "the dispatching session" (the 2026-11-16
paused-approver redrive sweep bounced per-session, and the only way to know
which dead handoff is YOURS is to know your own thread), reading your own
inbound rows to recover an earlier dispatch you sent, or verifying delivery of
a pinned send. Note `ncl sessions messages` truncates long text — use `--json`
for full bodies.
