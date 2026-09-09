---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786346030668-v6zm0g
written_at: 2026-08-11T08:24:02.533Z
---

# [approver/infra-abstain] record_decision returns "Decision recorded" even when the host DENIES the ledger append — the tool string is not proof of a write

# `record_decision`'s success string is not evidence the row landed

**Measured 2026-08-11, slang-rhi#598.** This invalidates a claim I have been making in every report
for months: *"decision recorded."*

## Symptom

`mcp__nanoclaw__record_decision(... decision: BLOCK ...)` returned, verbatim:

```
Decision recorded: shader-slang/slang-rhi#598@6d84fcf217b9 = BLOCK
```

Moments later the host emitted:

```
record_decision denied: no approval-ledger writers are configured (set APPROVAL_LEDGER_WRITERS)
```

**Both refer to the same call.** The tool result is optimistic/local; the authoritative outcome
arrives separately, and it can contradict the string you were just handed.

## Why this is worse than one lost row

I made three `record_decision` calls that session and **all three returned "Decision recorded"**.
Only the last produced a visible denial. I have **no read access** to the host ledger, so I cannot
tell whether the earlier two landed — and I had never checked, because the success string read like
confirmation. ⇒ **Every "recorded" I have reported upstream was an unverified claim about a
side-effect in someone else's system.**

This is the exact error class I keep writing rules about — *a claim about a state I did not open* —
except the state was my own bookkeeping, and the false confirmation was handed to me in a format that
suppressed the check.

## How to catch it

- **Treat a tool's success string as a request acknowledgement, not a write receipt** — especially for
  fire-and-forget MCP tools whose real effect lands in another process. The pattern to distrust:
  a confirmation phrased in the past tense about a system you cannot read back.
- **Watch for a host/system notification arriving after the tool result** and reconcile the two. If
  they disagree, the host wins.
- **When there is no read-back path, say "submitted" not "recorded"** in any report. If a decision's
  whole purpose is to be auditable later, an unverifiable append is not an audit trail.
- **Preserve the decision locally** whenever the ledger is the only copy: I wrote
  `work/<pr>-<sha>/LEDGER-WRITE-DENIED.md` carrying the full row (decision, reason_code, commit,
  clauses, critique verdicts, human-verdict join) so a human can re-append it.

## Fix (operator-side, not agent-side)

`APPROVAL_LEDGER_WRITERS` must include the agent group before any row can land. Until then a
shadow-mode accuracy programme is collecting **nothing** — which is a strictly worse failure than the
misclassification debates it exists to settle, and it is silent by construction.

⭐ **The generalizable rule: a measurement pipeline that cannot be read back cannot be trusted to be
recording. Probe the sink, not the send.**
