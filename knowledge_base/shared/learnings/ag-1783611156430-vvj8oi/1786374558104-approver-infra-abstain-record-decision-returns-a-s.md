---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786373305069-cta0ae
written_at: 2026-08-10T15:09:18.104Z
---

# [approver/infra-abstain] record_decision returns a SUCCESS STRING while the host denies the write — APPROVAL_LEDGER_WRITERS unset drops every row

## Symptom

On shader-slang/slang#12451 @`86e2a226d19d`, `mcp__nanoclaw__record_decision`
returned, as its tool result:

> Decision recorded: shader-slang/slang#12451@86e2a226d19d = ABSTAIN_POLICY

Seconds later a host notification arrived on the session:

> record_decision denied: no approval-ledger writers are configured
> (set APPROVAL_LEDGER_WRITERS)

**No ledger row was written.** The tool's affirmative past-tense string described
an append that the host refused. Same class as the earlier #823 burn (two SHAs
lost that way), but a *different root cause*: #823 was a group-capability denial,
this is `APPROVAL_LEDGER_WRITERS` being unset entirely — i.e. it drops rows for
**every** approver agent, not just an unprivileged one.

## Root cause

The MCP tool acknowledges receipt, not persistence; the host's authorization
check runs afterward and reports out-of-band, as a session notification rather
than as the tool's return value. So the success string is generated before the
decision that matters.

## How to catch it

- **The tool's success string is not the write.** Never treat `record_decision`'s
  return as proof of an append. Watch for a following host notification, and treat
  its absence as unconfirmed rather than confirmed.
- **Write the local artifact unconditionally.** `work/<pr>-<sha12>/decision.md`
  plus `clauses.json` / `investigation.md` are the durable record when the ledger
  refuses. Per standing rule the LEDGER + `decision.md` outrank memory — but when
  the ledger row doesn't exist, `decision.md` is the *only* record, so it must
  carry every field the row would have (decision, reason_code, mode,
  policy_version, review_diff_hash, ts) and an explicit **BACKFILL REQUIRED**
  banner naming the SHA.
- **Escalate, don't absorb.** An unset `APPROVAL_LEDGER_WRITERS` silently voids
  the entire measurement loop — no rows means no human-verdict joins means no
  accuracy signal, and nothing else surfaces it. Report it upstream on the same
  turn; only an operator can set it.
- **Generalizes:** any "I recorded / saved / sent it" that comes from a tool's own
  return string is a claim about a state I did not open. Prefer an independent
  read-back; where none exists (no ledger read tool here), say "attempted, host
  denied" rather than "recorded".

## Fix

Recorded ABSTAIN_POLICY / CHALLENGER_CONCERN in
`work/12451-86e2a226d19d/decision.md` with a BACKFILL REQUIRED banner, and
escalated the unset `APPROVAL_LEDGER_WRITERS` to the operator. Backfill
`shader-slang/slang#12451 @86e2a226d19d37fed93e9b226d7b42447378004e` once
configured.
