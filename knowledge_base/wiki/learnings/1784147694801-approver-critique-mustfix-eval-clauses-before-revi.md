---
title: "[approver/critique-mustfix] eval-clauses before review-doc synthesis leaves commit_match unevaluable"
type: learning
topic: review-approval
source: learnings/1784147694801-approver-critique-mustfix-eval-clauses-before-revi.md
---

# [approver/critique-mustfix] eval-clauses before review-doc synthesis leaves commit_match unevaluable

**Symptom:** On #12126 (protected `.github/**` path → obvious terminal ABSTAIN_POLICY), I ran `eval-clauses.py` *first* to confirm the protected-path FAIL, before synthesizing the review doc. Result: `commit_match` came back **unevaluable** ("review doc absent or carries no commit_id") and the summary showed a spurious `UNEVALUABLE=['commit_match'] -> ABSTAIN_INFRA` alongside the real `no_protected_paths` FAIL. The DECISION_REVIEW critique gate flagged this MUST_FIX: an ABSTAIN_INFRA-looking clause that is purely a self-inflicted staging-order artifact muddies the ledger and could, on a non-protected PR, wrongly route to ABSTAIN_INFRA.

**Root cause:** `eval-clauses.py`'s `commit_match` predicate reads `commit_id` from `review/review-doc.md`'s embedded `_approver_result` JSON block (see `review_commit_id()` / `_review_field()` in the script). If the doc doesn't exist yet, `commit_id` is absent → unevaluable. The `/slang-pr-approve` workflow orders it correctly (Step 1b synthesize doc → Step 2 decide, which runs clauses), but it's tempting to short-circuit and run clauses early when Step-0 recall already tells you the protected-path FAIL is coming.

**How to catch it:** Always synthesize `review/review-doc.md` (with `commit_id = commit_sha` on the Devin-only tier — a tier constant, independent of what Devin finds) *before* running `eval-clauses.py`. Even when a terminal protected-path FAIL is inevitable, build the full contracted input first so every non-failing clause evaluates cleanly. A terminal FAIL still governs the decision, but the ledger `clauses.json` should have zero unevaluable entries that are mere staging artifacts.

**Fix:** Order = harvest → (Devin best-effort) → synthesize doc → eval-clauses → decide. For Devin-only tier, the doc's `commit_id`/`diff_hash` are `commit_sha` / `commit:<sha>` sentinel and don't depend on Devin terminating — so you can synthesize a faithful doc (verdict null / `_verdict_consumed:false` / `reviewers_complete:false`) even if Devin is still running, then re-run clauses so `commit_match` passes. This leaves the protected-path FAIL as the sole, unambiguous ABSTAIN_POLICY basis. Confirmed on #12126: after synthesis + re-run, clauses = 5 pass + `no_protected_paths` FAIL, zero unevaluable.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784147694801-approver-critique-mustfix-eval-clauses-before-revi.md`_
