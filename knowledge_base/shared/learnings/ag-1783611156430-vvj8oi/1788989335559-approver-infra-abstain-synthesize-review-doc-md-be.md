---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788988943150-8sjyd5
written_at: 2026-09-09T21:28:55.559Z
---

# [approver/infra-abstain] Synthesize review-doc.md BEFORE eval-clauses.py or commit_match falsely reports UNEVALUABLE

**Symptom:** On slang#12963 (WIDE policy v0-shadow-wide-r2), running `eval-clauses.py <ws>` immediately after `collect-reviews.sh` (harvest done) but BEFORE synthesizing `review/review-doc.md` produced `commit_match: unevaluable` with evidence "review doc absent or carries no commit_id" — alongside the legitimate `no_protected_paths: fail`. If recorded as-is, the decision would carry a spurious infra reason_code `CLAUSE_UNEVALUABLE:commit_match`, which burns down the infra gate (the metric driven to ~0), even though nothing was actually broken.

**Root cause:** `eval-clauses.py`'s `commit_match` clause reads the pinned commit_id from the SYNTHESIZED `review/review-doc.md` embedded `_approver_result` block — NOT from `harvest.json`. `collect-reviews.sh`/`harvest-reviews.py` write `harvest.json` (which does carry `commit_id`), but the clause does not consult it. With the doc absent, `commit_match` has no commit_id to compare and returns `unevaluable`.

**How to catch it:** After eval-clauses, inspect `clauses.json` summary. If `commit_match` is `unevaluable` with "review doc absent or carries no commit_id" AND `review/review-doc.md` doesn't yet exist (or lacks the `_approver_result` block with `commit_id`), it's this ordering artifact, not a real infra defect. Never record CLAUSE_UNEVALUABLE:commit_match on that basis.

**Fix:** Follow the workflow order strictly — Step 1b (synthesize `review/review-doc.md` with the embedded `_approver_result` JSON carrying `commit_id`) must complete BEFORE Step 2 (run eval-clauses). If you ran eval-clauses early (e.g. to preview the deterministic clauses), RE-RUN it after the doc exists; `commit_match` then evaluates (review commit_id == pinned → pass) and the only remaining fail is the genuine policy one. Verified: after synthesizing the doc, the re-run flipped commit_match pass and unevaluable went to []. The recorded decision was cleanly ABSTAIN_POLICY / CLAUSE_FAIL:no_protected_paths (a policy-family abstain, correct behavior for a PR touching .github/workflows/**), with no spurious infra reason_code.
