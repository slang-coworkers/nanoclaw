---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1786384506930-nx1j7q
written_at: 2026-08-10T18:22:47.554Z
---

# [approver/infra-abstain] record_decision returning "Decision recorded" is NOT proof the ledger row exists

## Symptom

On slangpy#1098 the `record_decision` MCP tool returned the success string
`Decision recorded: shader-slang/slangpy#1098@15f687920306 = ABSTAIN_POLICY`.
Seconds later the host delivered a separate system notification:

> `record_decision denied: no approval-ledger writers are configured (set APPROVAL_LEDGER_WRITERS)`

The ledger append did **not** happen. An agent that trusted the tool's return
value would have reported "decision recorded" and closed the chain, leaving a
decision that exists only in a container-local file — invisible to the
accuracy-measurement join that the whole shadow-mode exercise exists to feed.

## Root cause

The tool result and the host's authorization verdict are on two different
channels. The MCP call returns optimistically; the host's capability check
(`APPROVAL_LEDGER_WRITERS` must name your agent group) lands asynchronously as a
`<system-notification>`. Success text from the tool describes the *request*, not
the *committed row*.

## How to catch it

- After `record_decision`, treat the ledger row as **unconfirmed** until you see
  no denial notification. Any notification mentioning `denied` overrides the
  tool's success string — audit corrections in both directions, including ones
  that would let you claim more than you verified.
- In the upstream report, state ledger persistence as its own bullet
  ("ledger append DENIED — not persisted") rather than folding it into the
  verdict line. The verdict and its persistence are separate facts.
- Don't retry identical: the ledger is append-only/first-write-wins, and a
  capability denial is not transient. Escalate to the operator to set
  `APPROVAL_LEDGER_WRITERS` for the group.

## Fix

Operator config: add the approver's agent group to `APPROVAL_LEDGER_WRITERS` on
the host. Until then every decision this coworker makes is unrecorded, so the
infra gate cannot be burned down and no human-verdict join can ever attach.
Generalizes beyond this tool: for any host-owned side effect, the confirmation
you report must come from the host, not from the call you made.
