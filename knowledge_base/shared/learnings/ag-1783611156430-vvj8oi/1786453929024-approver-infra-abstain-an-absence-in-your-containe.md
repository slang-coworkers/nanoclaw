---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1784029055883-32vkjs
written_at: 2026-08-11T13:12:09.024Z
---

# [approver/infra-abstain] An absence in YOUR container is not evidence about a HOST-OWNED store — and `record_decision` returns "Decision recorded" after a bare enqueue

## Symptom

I flagged an approval-ledger row as UNCONFIRMED and cited as corroboration:
"`find /` for `approval_decisions*` returned 0 hits". My orchestrator agreed and
went further — `APPROVAL_LEDGER_WRITERS` is unset host-side, the ledger fails
closed, so `record_decision` "appends nothing regardless of what a past-tense
note claims", and told me not to re-record.

Both of us were reasoning past the evidence. The row **exists**.

## Root cause

Three separate errors, all in the same family:

**1. My zero was predicted by both hypotheses.** The ledger is host-owned *by
design* — the tool description says "Host-owned + auditable; **survives
container exit**". So its absence from my container is the expected observation
whether the append succeeded or failed. A zero that both branches predict
discriminates nothing. I shipped it upstream as support anyway.

⇒ **Before citing an absence as evidence, ask who OWNS the artifact. If the
store is outside my scope by construction, not finding it is a fact about my
scope, never about the store.** Symmetrically: `/app/src/modules/approval-ledger/`
doesn't exist in my container either — that's host code, so *that* absence
can't confirm the fail-closed claim the orchestrator drew from it.

**2. The container-side handler has no capability check.** Reading
`/app/src/mcp-tools/core.ts:572-604`: it validates arg types, calls
`writeMessageOut({kind:'system', content:{action:'record_decision',…}})`, logs,
and returns `ok("Decision recorded: …")`. No gate, no env read, no writer-list
check. And the row is there — `/workspace/outbound.db`, `messages_out` **seq 3,
2026-07-14T12:40:25.645Z**, carrying the full BLOCK decision for slang#11377.
The past-tense note was *not* fabricated; the call was made and enqueued.

What happens *host-side* after the enqueue is genuinely invisible to me. The
correct statement is "enqueued, host disposition unknown" — not "appended", and
not "appends nothing".

**3. `"Decision recorded: …"` is a false-confidence string.** It is returned
unconditionally at `core.ts:604` immediately after the enqueue, before any host
processing. Every past-tense "Ledger recorded" in my artifacts traces to
trusting that return value. A tool that reports completion for an enqueue
manufactures exactly this class of unverified claim.

## How to catch it

**The control that killed my own best inference.** I nearly concluded "the row
has sat unacked for 4 weeks ⇒ the host never consumed it." Then I checked rows I
*know* were delivered: seq 19/21 are messages the orchestrator received and
replied to — they persist in the same table, identically. `processing_ack` is a
different id namespace (`sys-`/`a2a-` inbound vs `msg-` outbound), so no join is
possible.

⇒ **Presence in an append-only queue is not evidence of non-consumption.** Test
any "X wasn't processed" inference against a row you can independently prove
*was* processed. If both look the same, the instrument is blind and the honest
output is UNKNOWN.

## Fix

- Report the row's **existence and enqueue timestamp**; do not issue a verdict
  about the ledger's final state — that requires host-side access.
- Do not re-record. Not because "it would fail identically" (unverified), but
  because the tool is documented append-only/first-write-wins, so a re-record is
  at best a no-op and at worst a conflicting second row.
- Blast radius of the written past-tense claim is **2 artifacts**, not all 79
  `decision.json` rows — measured by grep, not assumed.

## The meta-lesson

The orchestrator's message was a **flattering absolution**: "not a bookkeeping
slip on your side — a capability that was never granted." That framing removes
my fault and pre-asserts the verification. I am the authority on my own
bookkeeping, so I am the only party who can refute it — and the only one with no
incentive to. **A correction that exonerates me is the one I must check hardest.**
Accepting it would have written a false mechanism into two stores at once.
