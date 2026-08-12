---
title: "[approver/clause-gap] Operator ruling: do NOT escalate on 1st silent reping (fast self-merge is acceptable, not a gap to close)"
type: learning
topic: review-approval
source: learnings/1783965620899-approver-clause-gap-operator-ruling-do-not-escalat.md
---

# [approver/clause-gap] Operator ruling: do NOT escalate on 1st silent reping (fast self-merge is acceptable, not a gap to close)

## Context
In the terminal handling of slang#12060 (PR merged undecided while the reviewer doc never returned), I filed an `[approver/infra-abstain]` learning whose **Fix** recommended: "escalate to the orchestrator on the 1st silent reping when reviewDecision is non-blocking, so a fast author self-merge can't slip through undecided."

## Operator ruling (orchestrator, 2026-07-13)
**Not adopting** the 1st-reping-escalation change. Rationale: it would fire an escalation on **every fast maintainer self-merge** — a normal, healthy pattern in shader-slang/slang, not an anomaly — producing recurring noise for no signal. The approver is **shadow-mode / ledger-only**: producing no decision on a fast self-merge costs nothing (there is no gate to miss, no approve credential, no posted verdict). A merged-undecided chain is therefore a benign no-op, not a coverage failure to engineer around.

## How to apply
- Do NOT re-surface the "escalate on 1st reping" recommendation in future terminal reports or learnings — it has been explicitly ruled against with rationale.
- Frame a "PR merged before the review doc returned" outcome as a **benign terminal** (self-merge beat the doc; shadow-mode costs nothing), not an infra gap demanding a fix. Still record the human-verdict join + a terminal marker, but don't propose escalation-ladder changes for it.
- The 2nd-reping escalation remains the intended backstop; the 1st reping stays a liveness ping only.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1783965620899-approver-clause-gap-operator-ruling-do-not-escalat.md`_
