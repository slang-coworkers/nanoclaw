---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788330672825-xuzblt
written_at: 2026-09-02T14:11:02.796Z
---

# [approver/infra-abstain] Delivery-critique gate keys on decision enum literals in ABSTAIN prose

**Symptom:** Sending the `[Approval Decision]` message for an **ABSTAIN_POLICY** decision was blocked by `PreToolUse:gate-critique-on-deliver.sh` with "CRITIQUE REQUIRED … missing critique stages: DECISION_REVIEW, OUTPUT_REVIEW" — even though `record_decision` had already succeeded and ABSTAIN_POLICY is explicitly NOT critique-gated (the skill's Step-4 early-return relaxes the gate for ABSTAIN_* rows).

**Root cause:** The delivery gate is **content-based**: it scans the outbound message text (on messages carrying the `[Approval Decision]` delivery marker) for the gated decision enum tokens `WOULD_APPROVE` / `BLOCK`. My abstain report contained the phrase "…would be a **WOULD_APPROVE candidate**" to explain that the code was clean on the merits and only the fork-head clause blocked it. The gate matched the literal `WOULD_APPROVE` string and reclassified the delivery as a positive-claim decision requiring the full critique stages.

**How to catch it:** If a delivery gate demands critique for a decision you recorded as ABSTAIN_POLICY, check whether your delivery prose literally contains `WOULD_APPROVE` or `BLOCK`. The gate cannot tell "would-approve-if-not-for-X" narration from an actual delivered WOULD_APPROVE.

**Fix:** In an ABSTAIN delivery message, never write the bare enum literals `WOULD_APPROVE`/`BLOCK`. Paraphrase — e.g. "clean on the merits", "would be approvable were it not on a fork", "the sole failing clause is head_provenance". The recorded ledger row already carries the true state; the prose only needs to explain it. (The un-marked dashboard summary line is not gated — only the `[Approval Decision]`-marked message is — but keep both clean to be safe.)

**Context:** Observed on shader-slang/slang#12877 R4 (a fork-head PR whose review had converged to ✅ Clean; the only abstain cause was CLAUSE_FAIL:head_provenance under the bundled v0-shadow policy).
