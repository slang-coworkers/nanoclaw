---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786375931183-s1yud1
written_at: 2026-08-10T18:23:37.083Z
---

# [approver/infra-abstain] record_decision returned "Decision recorded" while the host DENIED the write — APPROVAL_LEDGER_WRITERS unset; the success string is not the write

# `record_decision` printed success and the row was never written

**Case:** shader-slang/slang#12448 @ `e87cb320422a`, 2026-08-10, `ABSTAIN_POLICY:OPEN_GAP`.

The tool result read, verbatim:

```
Decision recorded: shader-slang/slang#12448@e87cb320422a = ABSTAIN_POLICY
```

Then a host notification arrived separately:

```
record_decision denied: no approval-ledger writers are configured
(set APPROVAL_LEDGER_WRITERS)
```

Two different channels, opposite content. **The tool's success string is not the write.**
Believing the tool result leaves a decision that exists only in a session transcript.

## Mechanism

The host enforces that the calling agent group holds the ledger-writer capability. Here
**no writers are configured at all** (`APPROVAL_LEDGER_WRITERS` unset), so every
`record_decision` from any group is refused. The denial is asynchronous — it does not
come back as the tool's return value — so a caller that reads only the tool result sees
unbroken success.

This is a recurrence of a known class (previously seen as two denials reported as
success). It is **not** group-specific misconfiguration to work around; it is a host
config gap.

## How to catch it

- After **every** `record_decision`, treat the returned string as *unconfirmed*. Look for
  a host denial notification in the same turn, and do not describe the row as recorded
  until you have an independent confirmation.
- `env | grep APPROVAL_LEDGER` inside the container shows nothing either way (the var is
  host-side), so absence of the var locally is not evidence.
- Write the durable local record regardless: `work/<pr>-<sha12>/decision.md` with the
  full field set, plus an explicit **BACKFILL NEEDED** banner naming
  `(repo, pr, commit_sha)`. Per the append-only ledger contract, first write wins and a
  repeated identical decision is a harmless no-op — so a later backfill of the same
  verdict is safe.
- Report the non-persistence **upstream** rather than silently proceeding: the decision
  itself is valid, but any claim that it is "recorded" is false.

## Why this matters more than it looks

The measurement loop is the whole point of shadow mode — decisions are joined against
human outcomes to score accuracy. A silently-dropped row is worse than a missing
decision: the join later finds nothing, the PR looks unexamined, and the calibration
signal for that PR is lost permanently. And because the failure surfaces as *success*,
nothing in the normal flow prompts a re-check.

**Rule: a write is not done until something other than the writer confirms it.** This is
the same shape as "an edit is not done until you verify it works" and "a memory write is
not done until its offset is verified" — the actor's own report of its action is the
weakest available evidence about that action.
