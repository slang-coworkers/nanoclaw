---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1783877918174-i2ugrr
written_at: 2026-08-11T13:29:12.360Z
---

# [approver/infra-abstain] record_human_verdict vanished from the approver allowlist mid-flight — the "re-stamp after correction" mitigation is not currently executable

# `record_human_verdict` is no longer callable from slangpy-pr-approver — my own published mitigation has a broken step

## Symptom

`mcp__nanoclaw__record_human_verdict` **worked on 2026-08-03** in a session where
I used it to restore the `APPROVED` stamp on slangpy#1085 @ `a1da5beac5af` after
a `record_decision` row replacement (tool result: `Human verdict recorded:
shader-slang/slangpy#1085@a1da5beac5af = APPROVED`).

On **2026-08-11**, in the same logical session, the identical call fails:

```
Error: No such tool available: mcp__nanoclaw__record_human_verdict
```

The tool is absent from the current nanoclaw allowlist (which has
`record_decision` but no `record_human_verdict`). Most likely a container
restart / allowlist change in the intervening 8 days.

## Why this matters beyond one call

The learning `[approver/infra-abstain] record_decision replaces the row and DROPS
any record_human_verdict stamp` prescribes: re-record, then **immediately
re-stamp**. That remediation is **not executable right now**. Anyone following it
today will do the destructive half and silently fail the repair half — strictly
worse than not correcting the row at all, because the correction *looks* clean.

## How to catch it

Before starting any batch that replaces rows carrying human verdicts, **probe the
repair tool first** on a no-op or check it is in your tool list. Never begin a
two-step destructive+repair sequence when you have not confirmed step two is
available. Generally: a mitigation that depends on a second tool is only as good
as that tool's current availability, and availability is per-session state, not a
durable fact.

## Fix / current guidance

- **Do NOT re-record a row that carries a `human_verdict` stamp** until
  `record_human_verdict` is restored to the approver allowlist. Report the needed
  correction upstream instead and let the host apply it.
- Signal corrections that don't need a row replacement (documenting in a
  session note / audit file) are unaffected.
- Belt-and-braces that DOES survive: embed the human verdict inside the
  correction payload itself (I put it in
  `clauses.signal_correction_*.decision_impact`), so a lost stamp is still
  recoverable from the row's own text.
- Ask the operator to re-add `record_human_verdict`, or to have `record_decision`
  preserve an existing `human_verdict` on replace — the latter removes the
  two-step hazard entirely.

Observed while auditing slangpy#1054, where I needed to stamp a
`CHANGES_REQUESTED` human verdict against a `WOULD_APPROVE` row and could not.
