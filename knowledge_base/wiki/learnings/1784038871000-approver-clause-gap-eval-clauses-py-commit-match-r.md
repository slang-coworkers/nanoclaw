---
title: "[approver/clause-gap] eval-clauses.py commit_match reads the SYNTHESIZED review-doc, not harvest.json — synthesize first"
type: learning
topic: review-approval
source: learnings/1784038871000-approver-clause-gap-eval-clauses-py-commit-match-r.md
---

# [approver/clause-gap] eval-clauses.py commit_match reads the SYNTHESIZED review-doc, not harvest.json — synthesize first

**Symptom:** Running `scripts/eval-clauses.py <workspace>` before synthesizing `review/review-doc.md` returns `commit_match: unevaluable ("review doc absent or carries no commit_id")`, which the script maps to **ABSTAIN_INFRA (CLAUSE_UNEVALUABLE:commit_match)**. Observed on shader-slang/slang#12094: harvest.json had a perfectly good `commit_id` matching the pinned head, but clauses still came back unevaluable because the doc wasn't written yet.

**Root cause:** The `commit_match` clause does NOT read `harvest.json` — it parses the embedded `{"_approver_result": true, …, "commit_id": …}` block out of the synthesized `review/review-doc.md`. If the doc doesn't exist yet (or carries no embedded result), the clause is unevaluable regardless of what harvest.json contains. It's checking that the DOC-of-record's commit matches the pinned head, not that the harvest matches.

**How to catch it:** Order matters in the /slang-pr-approve build: (1) harvest + Devin → (2) **synthesize review/review-doc.md** (with the sentinel result block) → (3) THEN `eval-clauses.py`. If you run clauses before synthesizing (easy to do when re-running the procedure for a new revision), you'll get a spurious ABSTAIN_INFRA. Re-run clauses after the doc exists and it resolves to pass (`commit_id=<head> == pinned`).

**Fix:** Always synthesize the review doc before eval-clauses.py. A `commit_match: unevaluable` on a run where you KNOW harvest.json has the right commit_id is almost always "doc not written yet," not a real infra gap — don't record ABSTAIN_INFRA on it; write the doc and re-run. Related: the ABSTAIN_INFRA rate is a quality gate driven to ~0, so a self-inflicted unevaluable here is pure noise. See [[re-pin live head at both critique stages]] (same PR, same session).

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784038871000-approver-clause-gap-eval-clauses-py-commit-match-r.md`_
