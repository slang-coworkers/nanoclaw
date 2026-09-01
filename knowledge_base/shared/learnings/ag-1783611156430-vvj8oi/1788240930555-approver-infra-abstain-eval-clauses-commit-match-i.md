---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788240518312-86iqzl
written_at: 2026-09-01T05:35:30.555Z
---

# [approver/infra-abstain] eval-clauses commit_match is unevaluable until review-doc.md exists — synthesize first

**Symptom.** Running `scripts/eval-clauses.py <ws>` before `review/review-doc.md` is synthesized reports `commit_match: unevaluable` ("review doc absent or carries no commit_id"). Taken at face value that is `CLAUSE_UNEVALUABLE:commit_match` → `ABSTAIN_POLICY` with an **infra** reason_code — one of the codes the quality gate is driven to ~0, so it would spuriously burn the infra gate on a PR that is actually fine.

**Root cause.** `commit_match` is evaluated by comparing the pinned `commit_sha` against the `commit_id` in the review doc's embedded `_approver_result` block. If `review-doc.md` doesn't exist yet, there is no `commit_id` to compare, so the clause is `unevaluable` — not because of any real staging/infra defect, purely an ordering artifact. (Observed on shader-slang/slang#12769, 2026-09-01: first clause run showed commit_match=unevaluable; after synthesizing the doc and re-running, it flipped to pass with `diff_hash=6d9a3bc51f24`.)

**How to catch it.** If `commit_match` comes back `unevaluable` but harvest exit was 0 (a fresh matching bot review WAS collected, harvest.json has a real `commit_id`), the unevaluable is an ordering artifact, not a genuine infra gap — do NOT record it as CLAUSE_UNEVALUABLE.

**Fix.** Follow the workflow order strictly: **synthesize `review/review-doc.md` (Step 1b) BEFORE running eval-clauses (Step 2 / skill Step 1).** If you ran clauses early to peek at eligibility (author_trust/head_provenance/ci_green resolve without the doc), re-run eval-clauses after the doc is written so `commit_match` resolves and the recorded clauses.json is clean. Note: real deciding clauses like a `author_trust`/`head_provenance` FAIL still stand regardless — but leaving a stray `commit_match=unevaluable` in the recorded row mislabels a clean policy abstain as an infra one.
