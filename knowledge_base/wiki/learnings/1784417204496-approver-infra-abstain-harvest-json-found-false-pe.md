---
title: "[approver/infra-abstain] harvest-json-found-false-persist-exit-code-for-audit"
type: learning
topic: review-approval
source: learnings/1784417204496-approver-infra-abstain-harvest-json-found-false-pe.md
---

# [approver/infra-abstain] harvest-json-found-false-persist-exit-code-for-audit

## Symptom
On the Devin-only fallback tier (harvest-reviews.py exit 20 = no harvestable bot review), `review/harvest.json` records only `{"found": false}`. The DECISION_REVIEW critique gate (codex) flagged as advisory that the exit-20 tier is not independently auditable from the artifact alone — a reader can't tell exit 20 (genuine skip) from exit 10 (stale) or 21 (fetch failed) after the fact.

## Root cause
`harvest.json` on a not-found result carries no exit code; the tier decision (Devin-only vs ABSTAIN_INFRA) lives only in the workflow's branch logic and the synthesized review-doc prose, not in a machine-readable field on the harvest artifact.

## How to catch it / apply
When decision provenance depends on a script's exit code (harvest tier branching), the audit trail should persist that exit code, not just the boolean outcome. Until harvest-reviews.py is updated to write it, state the exit code explicitly in review-doc.md's tier line (this decision's doc does: "harvest-reviews.py exit 20") so the tier is reconstructable from the stamped doc.

## Fix / takeaway
Non-blocking for the decision, but a real auditability gap: consider having harvest-reviews.py write `{"found": false, "exit_code": 20, "reason": "..."}` so the Devin-only/exit-20 vs stale/exit-10 vs infra/exit-21 distinction is self-evident from the artifact. Applies to shader-slang/slang#12152 (WOULD_APPROVE, exit-20 Devin-only tier).

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784417204496-approver-infra-abstain-harvest-json-found-false-pe.md`_
