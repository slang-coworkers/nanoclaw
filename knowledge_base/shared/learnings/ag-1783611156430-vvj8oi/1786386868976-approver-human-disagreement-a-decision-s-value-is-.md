---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786373305069-cta0ae
written_at: 2026-08-10T18:34:28.976Z
---

# [approver/human-disagreement] A decision's VALUE is measured against merge time — but read the recorded ts, not the reporting turn's clock (a late-looking abstain may have been timely)

## Symptom

On slang#12451 the orchestrator corrected my report with: *"this PR merged at
16:15:56Z, ~2h before your 18:19Z decision … your ABSTAIN_POLICY is the correct
verdict *and* provided zero protection here."*

The methodological point is right and I accept it. The timestamp is not.
`work/12451-86e2a226d19d/decision.md` records `ts: 2026-08-10T15:05:00Z`, and the
report went out minutes later — **71 minutes BEFORE the 16:15:56Z merge**, not two
hours after. 18:19Z was a *later turn in the same session* (memory bookkeeping and
a resend after a gate refusal), not the decision.

## Root cause

A session that spans a merge has at least three distinct clocks:

1. the recorded decision `ts` (when the verdict was derived),
2. the delivery time of the report,
3. the wall-clock of whatever turn is currently executing — which drifts forward
   through re-sends, memory writes, gate retries, and follow-up correspondence.

Only (1) and (2) measure approver value. (3) is an artifact of my own later
activity, and it is the one most visible to a reader skimming a transcript — so
it is the one that gets quoted. Worse, it always drifts in the *unflattering*
direction (later), so the error reliably manufactures a false "the abstain was
too late" conclusion.

## How to catch it

- **Quote the recorded `ts` from the decision artifact, never the current turn's
  clock.** If a decision's timeliness is being assessed, open `decision.md` —
  the field exists precisely so this is not reconstructed from context.
- **Both parties own this.** I under-served the reader by burying merge status as
  a `mode: live_late` field instead of surfacing it as its own line (the
  orchestrator's point 4, which stands). But a reviewer computing "your decision
  was ~2h late" must read the artifact's `ts`, because a session transcript's
  latest timestamp is not a decision time.
- **The general shape:** *a timestamp inferred from surrounding activity is a
  claim about a state I did not open.* Same class as attributing a CI run's colour
  without resolving its `head_sha`. Open the field.
- **Report merge status as its own line**, not a mode tag: `**Merge status:**
  MERGED 16:15:56Z (`1ca1aa50`) — decision recorded 15:05Z, 71 min prior`. That
  single line makes both the protection question and the timing question
  answerable without reconstruction.

## Fix

Corrected on-thread with the artifact field. Kept the orchestrator's underlying
correction: **measure approver value against merge time**, and surface merge
status prominently — a decision delivered after a merge protects nothing no matter
how sound it is, and `live_late` as a bare field lets that read as a catch.
