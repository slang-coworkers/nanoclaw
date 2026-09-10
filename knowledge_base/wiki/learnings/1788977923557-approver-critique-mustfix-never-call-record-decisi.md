---
title: "[approver/critique-mustfix] Never call record_decision before the review input is fully built — append-only ledger cannot be corrected in-session"
type: learning
topic: review-approval
source: learnings/1788977923557-approver-critique-mustfix-never-call-record-decisi.md
---

# [approver/critique-mustfix] Never call record_decision before the review input is fully built — append-only ledger cannot be corrected in-session

---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788976610855-ntn481
written_at: 2026-09-09T18:18:43.557Z
---

# [approver/critique-mustfix] Never call record_decision before the review input is fully built — append-only ledger cannot be corrected in-session

## Symptom
On slang#12982 (a `.github/workflows/**` protected-path change → deterministic
ABSTAIN_POLICY / CLAUSE_FAIL:no_protected_paths), I "optimized" by calling
`record_decision` right after eval-clauses.py reported the Step-1 protected-path
FAIL, skipping the workflow's exit-20 review-input construction (Devin-only +
synthesize review-doc.md). The DECISION_REVIEW critique flagged this as
scope-shrinkage (must-fix). When I then built the review input properly and
re-ran clauses, `commit_match` flipped unevaluable→pass — but the ledger row was
already written, and `record_decision` is APPEND-ONLY, first-write-wins
(core.ts:550). The identical-decision resubmission was a no-op, so the persisted
row permanently retained the stale evidence (`clauses.commit_match=unevaluable`
and a challenger field saying "Devin not run"). There is NO
correction/invalidation verb exposed to the approver group.

## Root cause
Recording before the review input is final. A Step-1 clause FAIL short-circuits
the DECISION, but it does NOT waive the workflow's prerequisite of building the
review input (harvest / Devin-only synthesis). Recording early bakes an
incomplete clauses.json into an immutable row.

## How to catch it
Before calling `record_decision`, confirm the workspace contains a synthesized
`review/review-doc.md` and that `clauses.json` has ZERO `unevaluable` clauses
that a completed review input would have resolved (esp. `commit_match`, which is
unevaluable purely because the review doc is absent). If any review-dependent
clause is unevaluable only for lack of the doc, finish the input FIRST.

## Fix
Order of operations is fixed even on a deterministic policy abstain: (1) harvest;
(2) on exit 20/10 run Devin best-effort + synthesize review-doc.md; (3) run
eval-clauses.py; (4) ONLY THEN record_decision — once, on the final clauses. The
decision/reason_code are what drive scoring + the infra gate (ABSTAIN_POLICY is
excluded from agreement scoring; a POLICY reason_code doesn't touch the infra
gate), so a premature write doesn't corrupt the measured metrics — but it does
leave a permanently stale audit-evidence subfield that only the operator can
correct host-side. Don't create that debt: record last.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1788977923557-approver-critique-mustfix-never-call-record-decisi.md`_
