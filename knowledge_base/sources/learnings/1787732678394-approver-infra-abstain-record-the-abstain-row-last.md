---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786435332070-exgjs1
written_at: 2026-08-26T08:24:38.394Z
---

# [approver/infra-abstain] Record the ABSTAIN row LAST — the mechanical delivery gate can force a critique that flips the verdict AFTER the append-only write locks it

## Symptom
On slang#12446 R10 the canonical ledger row is ABSTAIN_POLICY while the true,
verified verdict is WOULD_APPROVE — and they can never be reconciled because the
ledger is append-only first-write-wins per (repo, pr, commit_sha). The
WOULD_APPROVE `record_decision` even returned "Decision recorded …" (a false
success) before the host refused it with "a decision for this commit is already
recorded (ABSTAIN_POLICY)".

## Root cause — an ordering interaction between two subsystems
The slang-pr-approver skill says: an ABSTAIN "asserts nothing about the code, so
it is NOT critique-gated" → record it DIRECTLY and STOP. I did (08:02Z). But the
MECHANICAL delivery gate (`gate-critique-on-deliver.sh`) is EDIT-COUNT based and
VERDICT-UNAWARE: it counts edits since the last critique round and blocks the
`[Approval Decision]` delivery message until an OUTPUT_REVIEW critique is
recorded — regardless of whether the decision is an ABSTAIN. My artifact/memory
writes pushed the edit count over the cap, so the gate forced an OUTPUT_REVIEW
before I could send. That critique correctly OVERTURNED the abstain to
WOULD_APPROVE — but by then the append-only ABSTAIN row was already committed and
locked. The two subsystems disagree: the skill treats ABSTAIN as gate-exempt;
the delivery gate does not exempt it.

## How to catch it / Fix
WRITE THE APPEND-ONLY LEDGER ROW LAST — after every step that could still change
the verdict, including the critique the MECHANICAL delivery gate will demand
before you can send. Concretely, even for an ABSTAIN: do the artifact + memory
writes FIRST (they bump the edit counter), THEN run the OUTPUT_REVIEW critique
the gate will require anyway, THEN call `record_decision`, THEN send the
`[Approval Decision]` message. The skill's "ABSTAIN skips the critique gate,
record directly and STOP" is only safe when NO mechanical gate can interpose a
verdict-changing critique afterward — which is not true when edits since the last
critique already exceed the delivery cap. Treat "record_decision" as the LAST
irreversible action of the turn, never an early one. Also: "Decision recorded"
from the tool is a known false-success — confirm against the host's follow-up
refusal/acceptance, don't trust the string.

## Scope
This is a procedure/infra defect, not a code judgment. The underlying review
verdict (WOULD_APPROVE) was correct; the ledger just can't hold it. Worth a
host-side fix: either make the delivery gate verdict-aware (exempt ABSTAIN rows
consistently with the skill), or make the skill defer even the ABSTAIN
record_decision until after any gate-forced critique.
