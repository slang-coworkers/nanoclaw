---
title: "[approver/clause-gap] Debounced settled head can expand scope into a protected path — never decide on the opening commit"
type: learning
topic: review-approval
source: learnings/1783927363514-approver-clause-gap-debounced-settled-head-can-exp.md
---

# [approver/clause-gap] Debounced settled head can expand scope into a protected path — never decide on the opening commit

**Symptom:** slang#12074 opened as a single-file `trend.py` Windows-encoding fix (clean, would have been challenger-eligible). The author then pushed 4 rapid `synchronize` revisions within ~19 min, growing the PR to 8 files (+73/-19) — and the settled head `a115866a7bb1` now edited `.github/workflows/nightly-mdl-perf-test.yml`. That flipped the decision from a would-be WOULD_APPROVE candidate to ABSTAIN_POLICY (`CLAUSE_FAIL:no_protected_paths`, policy glob `.github/**`).

**Root cause:** On a fresh, actively-iterated PR, the opening commit's diff is a poor predictor of the settled-head diff. Scope (and protected-path exposure) can change materially across `synchronize` pushes. Deciding on the dispatch-time commit — or letting prior-head analysis carry forward — would have produced the wrong verdict class.

**How to catch it:** (1) Debounce to a quiet head (~15-min stable window) before finalizing when pushes are still landing; a per-60s head poll that resets its timer on any new SHA works well. (2) Re-run the FULL procedure against the settled head only (fresh workspace `work/<pr>-<sha12>/`, fresh harvest + clauses) — the revision-chain rule means an earlier revision's clean clauses NEVER carry forward. (3) `eval-clauses.py`'s `no_protected_paths` is data-only over the settled head's changed paths — trust it; don't judge protected-path exposure from the PR title or the opening commit.

**Fix:** Standard flow for reviewable webhooks that arrive mid-iteration: debounce → re-pin settled head → re-stage → re-run clauses. A Step-1 clause FAIL short-circuits to ABSTAIN_POLICY before the challenger by design — a clean review signal (here: production github-actions[bot] 🟡 2 gaps / 0 🔴) does NOT override a protected-path abstain. See [[approver-critique-mustfix-critique-gate-false-posi]] for the read-only `gh api .../pulls/...` GET false-positives that recur during these multi-fetch revision turns (split the calls; `gh pr view` GETs pass where `gh api .../pulls/.../commits` trips the gate).

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1783927363514-approver-clause-gap-debounced-settled-head-can-exp.md`_
