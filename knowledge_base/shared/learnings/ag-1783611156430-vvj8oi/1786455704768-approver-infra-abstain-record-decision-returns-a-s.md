---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786453430063-fe5us0
written_at: 2026-08-11T13:41:44.768Z
---

# [approver/infra-abstain] record_decision returns a SUCCESS STRING while the host denies the ledger append — never treat the tool's reply as proof the row exists

## Symptom

On shader-slang/slang#12439 @`c73384e212cb` (2026-08-11 ~13:40Z), `mcp__nanoclaw__record_decision`
returned, as its tool result:

```
Decision recorded: shader-slang/slang#12439@c73384e212cb = ABSTAIN_POLICY
```

Seconds later the host emitted, on a separate channel (a `system-notification`,
NOT the tool result):

```
record_decision denied: no approval-ledger writers are configured (set APPROVAL_LEDGER_WRITERS)
```

So the row does **not** exist. The tool's affirmative past-tense string
("Decision recorded") described an intent, not an outcome.

## Root cause

Two different surfaces report on the same write, and they disagree:

- the **tool result** is generated at the call site (the MCP shim), before/independent of
  the host's capability check;
- the **host** enforces `APPROVAL_LEDGER_WRITERS` and reports the denial asynchronously,
  as a notification into the next turn.

The capability is a host-side *allow-list of agent groups*. When it is unset
(not merely "my group is missing" — **no writers configured at all**), every
`record_decision` call is denied. The tool's own reply carries no signal of this.

## How to catch it

- **Never let the tool's success string close the loop.** A ledger append is a claim
  about host state; the only surfaces that can confirm it are the host's own
  notification and the ledger itself. If the write matters, say "recorded" only when
  a host-side surface says so.
- **Read notifications that arrive right after a write as being ABOUT that write.**
  This one arrived framed as a user/system message, i.e. as *context*, not as a tool
  error — exactly the shape that gets read past.
- Generalization worth carrying: **an affirmative reply from the layer that INITIATES
  a write is not evidence from the layer that PERFORMS it.** Same shape as a green
  `else` branch reached by fall-through: nothing had to succeed for the string to print.

## Fix

1. Treat the denial as authoritative; write the decision + derivation into
   `work/<pr>-<sha12>/decision.md` and `investigation.md` so the record survives
   outside the ledger, and **state the gap explicitly** in the upstream report —
   "decision made, ledger append DENIED (reason)" — rather than reporting a clean
   "recorded".
2. Escalate to the operator: `APPROVAL_LEDGER_WRITERS` must name the approver's
   agent group. Until then **every** decision this session (and any peer approver
   session) is unrecorded — this is a fleet-wide gate, not a per-PR hiccup.
3. Retry is safe once configured: the ledger is append-only, one row per
   `(repo, pr, commit_sha)`, first write wins ⇒ re-submitting the identical decision
   is a no-op, and a *different* decision for the same commit is refused rather than
   silently overwritten.
4. This is a defect in the recording pipeline, not in the PR — it does not change the
   verdict, and it must not be laundered into an `ABSTAIN_INFRA` about the PR. The
   PR's own decision stands on its own artifacts.
