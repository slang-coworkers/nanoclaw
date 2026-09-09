---
title: "[approver/procedure] ABSTAIN still needs both critique stages to pass the message-delivery gate; synthesize the Devin-only review doc BEFORE eval-clauses even for a clause-fail abstain"
type: learning
topic: review-approval
source: learnings/1788850479837-approver-procedure-abstain-still-needs-both-critiq.md
---

# [approver/procedure] ABSTAIN still needs both critique stages to pass the message-delivery gate; synthesize the Devin-only review doc BEFORE eval-clauses even for a clause-fail abstain

---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788849023447-ik9ptj
written_at: 2026-09-08T06:54:39.837Z
---

# [approver/procedure] ABSTAIN still needs both critique stages to pass the message-delivery gate; synthesize the Devin-only review doc BEFORE eval-clauses even for a clause-fail abstain

## Symptom
On a Step-1 clause-fail ABSTAIN (bot-authored PR → `CLAUSE_FAIL:author_trust`), the skill says an ABSTAIN "is NOT critique-gated — SKIP DECISION_REVIEW / OUTPUT_REVIEW, call record_decision directly, send the [Approval Decision] message, and STOP." `record_decision` DID succeed (host relaxes the *record* gate for `ABSTAIN_*` rows). But the separate **message-delivery gate** (`gate-critique-on-deliver.sh`, PreToolUse on the outbound `[Approval Decision]` marker) then REFUSED delivery: "required critique stages are missing: DECISION_REVIEW, OUTPUT_REVIEW."

## Root cause
Two independent gates. (1) The `record_decision` MCP gate is relaxed for ABSTAIN rows. (2) The message-delivery gate keys purely on the `[Approval Decision]` marker text + recorded critique rounds; it does NOT read the decision state, so it enforces DECISION_REVIEW + OUTPUT_REVIEW=approve regardless of ABSTAIN. The skill's "skip critique for ABSTAIN" only covers the record gate, not delivery. So in practice you MUST run both `/codex-critique` stages to get the `[Approval Decision]` message out — even for a clean policy abstain.

## Also: run order matters for clean clauses
`eval-clauses.py` leaves `commit_match` **unevaluable** if run before a review doc exists. On the Devin-completed (harvest exit-20) tier, synthesize `review/review-doc.md` FIRST (embedded `_approver_result` json with `commit_id = commit_sha`), THEN run eval-clauses — `commit_match` then PASSES and nothing is spuriously unevaluable. Codex OUTPUT_REVIEW flagged the missing doc + "commit_match unevaluable" as a must-fix input-contract violation, even though `author_trust` was independently decisive. Decision was unchanged, but the recorded evidence/artifacts must be complete and consistent.

## Freshness caveat codex enforces
`devin-fetch.sh` writes `devin-commit-status.txt`; when it is `unknown`, do NOT claim "Devin ran over the PR head" / "head-current." State "Devin completed and reported no findings on the fetched PR snapshot; exact freshness vs the pinned head not independently verified." The Devin-only tier sets `commit_id = pinned head` **by contract**, which is NOT independent evidence of Devin freshness — say so explicitly in the review doc.

## How to catch it / fix
For every `[Approval Decision]` delivery (incl. ABSTAIN): budget for the two critique rounds; synthesize the review doc before clauses; word Devin freshness conservatively. `record_decision` succeeding does NOT mean the message will ship.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1788850479837-approver-procedure-abstain-still-needs-both-critiq.md`_
