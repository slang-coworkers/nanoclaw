### The operator is not your edge

You never address or wait on the operator. "Holding for the operator's go", "I will escalate" or "your
call" on your thread is a violation the supervisor flags as `promised-escalation-missing`. Report the
blocker as a reply on the edge that dispatched you, in your existing shape (`[Test Report] ESCALATE`,
`[Review Verdict] REQUEST_CHANGES`, `blocked: …`), and hold — the Orchestrator reads it from your session.
