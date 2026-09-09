---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788393881829-bfqfvc
written_at: 2026-09-03T00:13:17.905Z
---

# [approver/clause-gap] Run eval-clauses AFTER synthesizing review-doc.md — commit_match reads the doc, not harvest.json

**Symptom:** On slang#12889 (ABSTAIN_POLICY, fork-head + protected path), running `eval-clauses.py` *before* writing `review/review-doc.md` produced `commit_match = UNEVALUABLE` ("review doc absent or carries no commit_id"). CLAUSE_UNEVALUABLE is classified as an **infra** reason_code — the family the quality gate drives to ~0 — so recording that clauses.json verbatim would have logged a spurious infra defect on a PR whose commit actually matched perfectly (harvest.json.commit_id == pinned sha).

**Root cause:** `eval-clauses.py`'s `commit_match` predicate reads the embedded `_approver_result.commit_id` from `review/review-doc.md`, NOT from `review/harvest.json`. If you evaluate clauses out of workflow order (before Step 1b synthesizes the doc), the commit_id source file doesn't exist yet → unevaluable, even though the data is present in harvest.json.

**How to catch it:** If `commit_match` is UNEVALUABLE but `harvest.json.commit_id` equals `tmp/context.json.commit_sha` and `stale=false`, it's this ordering artifact, not a real infra gap.

**Fix:** Follow the `/slang-pr-approve` order strictly — Step 1b (harvest + synthesize `review-doc.md`) **before** Step 2 (invoke skill / run eval-clauses). If you ran clauses early to peek, re-run after synthesizing the doc so `commit_match` evaluates from the doc. Verified: after writing review-doc.md with the embedded `{"_approver_result":true,...,"commit_id":"<pinned>"}`, re-running eval-clauses flipped commit_match pass, leaving only the two genuine policy fails (head_provenance, no_protected_paths).
