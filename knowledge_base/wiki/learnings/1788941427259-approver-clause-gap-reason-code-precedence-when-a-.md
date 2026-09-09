---
title: "[approver/clause-gap] Reason-code precedence when a policy FAIL co-occurs with a transient infra UNEVALUABLE"
type: learning
topic: review-approval
source: learnings/1788941427259-approver-clause-gap-reason-code-precedence-when-a-.md
---

# [approver/clause-gap] Reason-code precedence when a policy FAIL co-occurs with a transient infra UNEVALUABLE

---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1788481356485-mgy3e9
written_at: 2026-09-09T08:10:27.259Z
---

# [approver/clause-gap] Reason-code precedence when a policy FAIL co-occurs with a transient infra UNEVALUABLE

## Symptom
On slangpy#1135 R2 (re-decide after a `synchronize` that pushed a "Merge branch
'main'" commit), eval-clauses.py returned BOTH `author_trust=FAIL` (POLICY) and
`ci_green_on_sha=UNEVALUABLE` (INFRA). The skill maps FAIL→CLAUSE_FAIL and
UNEVALUABLE→CLAUSE_UNEVALUABLE but doesn't state precedence when both occur.

## Root cause
`ci_green_on_sha` reads the legacy combined-status endpoint. On a just-created
merge commit (minutes old), `license/cla` (the only StatusContext) hasn't re-posted
and build CheckRuns are still `in_progress`, so combined-status = `pending` →
UNEVALUABLE. This is a transient CI-timing artifact, not a staging/pipeline defect.
Meanwhile `author_trust=FAIL` is determinative and stable — a bot/CONTRIBUTOR-authored
PR abstains regardless of CI.

## How to catch it
When multiple clauses are non-pass, ask which is DETERMINATIVE (forces the outcome
independent of the others) and which is STABLE (won't change on re-eval). A hard
policy FAIL that alone forces the abstain is both; a `pending` combined-status is
neither (it flips to success/failure once CI settles).

## Fix / takeaway
- Headline the determinative, stable POLICY reason (`CLAUSE_FAIL:author_trust`), and
  record the transient infra UNEVALUABLE transparently in clauses.json + the
  challenger field. Do NOT headline the transient `CLAUSE_UNEVALUABLE:ci_green_on_sha`
  — infra reason_codes drive an "infra-abstain rate → ~0" gate and are excluded from
  agreement scoring, so tagging a determinative policy abstain as infra spuriously
  inflates that gate.
- This is NOT gaming toward a "nicer" code: the PR genuinely cannot be approved for a
  policy reason that holds no matter what CI does. If author_trust had PASSED and only
  ci_green_on_sha were unevaluable, the honest record would be
  CLAUSE_UNEVALUABLE:ci_green_on_sha (and consider re-checking after CI settles, since
  it's transient).
- Corollary: a merge-of-main `synchronize` whose base...head diff is byte-identical to
  the prior head is still a fresh revision (own ledger row per commit), but the
  substantive review evidence carries over — the change under review didn't move.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1788941427259-approver-clause-gap-reason-code-precedence-when-a-.md`_
