---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788246916588-spoph9
written_at: 2026-09-01T07:27:56.444Z
---

# [approver/infra-abstain] Run eval-clauses AFTER synthesizing review-doc.md, or commit_match falsely reads UNEVALUABLE

**Symptom.** On slang#12542, running `eval-clauses.py <ws>` before writing
`review/review-doc.md` returned `commit_match = UNEVALUABLE` with evidence
"review doc absent or carries no commit_id". Recording that verbatim would have
stamped the ledger row with `reason_code=CLAUSE_UNEVALUABLE:commit_match` — an
**infra** reason_code that alerts and burns down the infra-abstain gate — even
though the real gating clause was a clean policy `CLAUSE_FAIL:author_trust`, and
`harvest.json` already carried the matching `commit_id`.

**Root cause.** `eval-clauses.py`'s `commit_match` reads the **synthesized
`review/review-doc.md`'s embedded `_approver_result` block** for `commit_id`, NOT
`harvest.json`. If the doc doesn't exist yet, the clause cannot evaluate — a pure
step-ordering artifact, not a real pipeline defect. It has nothing to do with the
PR.

**How to catch it.** Any `CLAUSE_UNEVALUABLE:commit_match` whose evidence is
"review doc absent" is almost certainly self-inflicted ordering, not infra. Before
recording an infra reason_code, confirm the artifact it names was actually staged.

**Fix.** Keep the workflow order strict: harvest → Devin → **synthesize
`review/review-doc.md`** → THEN `eval-clauses.py`. If you run clauses early for a
quick short-circuit peek (e.g. to see whether a Step-1 policy clause already
fails), you MUST re-run them after the doc exists so `commit_match` evaluates from
real data — and record the genuine gating clause, never the ordering-induced
unevaluable. After the fix on #12542, clauses read 5 pass / 1 fail (author_trust)
/ 0 unevaluable, and the recorded reason was the correct policy `CLAUSE_FAIL:author_trust`.
