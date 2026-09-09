---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787899248267-0czc4i
written_at: 2026-08-29T05:00:44.168Z
---

# [approver/human-disagreement] slang-rhi#847 ABSTAIN:ESCALATED vs human APPROVED — critique-gate deadlock as false-abstain

**Symptom.** On slang-rhi#847 ("Add cache key to compilation reports") my substantive read was WOULD_APPROVE and DECISION_REVIEW passed (approve), but OUTPUT_REVIEW (codex) held must-fix for 3 rounds on two MATERIALITY calls I would not capitulate to on the merits. The operator escalation timed out (15 min, no ruling). I recorded ABSTAIN_POLICY / reason_code=ESCALATED (the procedurally-correct soft-cap landing; ABSTAIN_* rows are not critique-gated so record_decision goes through). The PR had already MERGED at my exact pinned head b71c71cd618d with tdavidovicNV APPROVED — i.e. a clean human approval that REFUTES an abstain under the falsifiable frame ("material enough not to merge as-is").

**Root cause.** The two OUTPUT_REVIEW must-fixes were judgment splits, not factual errors (I corrected every factual item codex raised). A persistent critic must-fix on a *materiality* call, with no human tiebreak, forces the gate to land ABSTAIN even when the approver's read and the eventual human outcome both say APPROVE. That is a structural false-abstain: the gate cannot distinguish "approver is wrong" from "critic is over-conservative on severity."

**How to catch it / apply.** (1) When the split is severity/materiality (not a fact), and one side won't move, that IS the "a human must look" state — ABSTAIN:ESCALATED is correct; do NOT override your own gate to force WOULD_APPROVE, and do NOT adopt the critic's OPEN_GAP as if you agreed. (2) Record your substantive read explicitly in decision.md + challenger field so the join can score it — the ledger row is ABSTAIN (excluded from agreement scoring) but the note preserves that a clean human approve at head agreed with the un-recorded WOULD_APPROVE. (3) Escalate with a bounded timeout and a stated default landing, so a silent operator doesn't strand the decision. (4) The materiality bar itself: a diagnostic/telemetry-only field with no codegen/runtime blast radius, and an ABI concern resting on an invariant the repo doesn't actually hold, are the two recurring "codex says OPEN_GAP, approver says nit" shapes — see the companion learning on invariant SCOPE.

**Fix (procedure).** Soft-cap on a materiality-only disagreement → ABSTAIN_POLICY:ESCALATED, record substantive read, join the human verdict when the merge/close event routes back. Don't burn >3 OUTPUT_REVIEW rounds re-litigating a severity call — escalate at round 3.
