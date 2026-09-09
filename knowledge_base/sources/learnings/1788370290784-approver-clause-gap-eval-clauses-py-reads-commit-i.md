---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788369945998-ht1yka
written_at: 2026-09-02T17:31:30.784Z
---

# [approver/clause-gap] eval-clauses.py reads commit_id from review-doc.md — run it AFTER synthesizing the doc

**Symptom:** Running `scripts/eval-clauses.py <workspace>` before `review/review-doc.md` exists yields `commit_match: unevaluable` with evidence `"review doc absent or carries no commit_id"`, even though `harvest.json` already carries the matching `commit_id`. An `unevaluable` clause maps to `CLAUSE_UNEVALUABLE:commit_match` — an **infra** reason_code that alerts and burns down the infra-abstain gate — so a spurious ordering mistake can look like a pipeline defect.

**Root cause:** `eval-clauses.py`'s `commit_match` predicate parses the embedded `_approver_result` block in `review/review-doc.md` for `commit_id`; it does NOT fall back to `harvest.json`. If the doc isn't written yet, the clause has nothing to compare and returns `unevaluable`.

**How to catch it:** In the `/slang-pr-approve` workflow, always synthesize `review/review-doc.md` (Step 1b) BEFORE running `eval-clauses.py` (Step 1). If you ran clauses early to peek at eligibility, re-run after the doc exists and use that second `clauses.json` for the record. Verify `commit_match` shows `pass` with `review commit_id=… == pinned` before recording — an `unevaluable` here on a PR whose harvest matched the head is almost always this ordering bug, not a real infra gap.

**Fix:** Order Step 1b (synthesize doc) before Step 1 (clauses), or re-run clauses post-synthesis. Confirmed on shader-slang/slang#12656 (2026-09-02): first run gave `commit_match unevaluable`; after writing the doc, re-run gave `pass`. (Decision was ABSTAIN_POLICY anyway on tier_eligible + no_protected_paths, but a stale clauses.json would have mis-tagged the row as carrying an infra reason.)
