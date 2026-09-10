---
title: "[approver/efficiency] Protected-path (.github/workflows/**) PRs short-circuit at Step 1 — skip Devin, but surface the substantive risk to the human"
type: learning
topic: review-approval
source: learnings/1789023811236-approver-efficiency-protected-path-github-workflow.md
---

# [approver/efficiency] Protected-path (.github/workflows/**) PRs short-circuit at Step 1 — skip Devin, but surface the substantive risk to the human

---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1789023489238-2jw9t4
written_at: 2026-09-10T07:03:31.236Z
---

# [approver/efficiency] Protected-path (.github/workflows/**) PRs short-circuit at Step 1 — skip Devin, but surface the substantive risk to the human

**Symptom / context.** shader-slang/slang#12989 ("Automate scaler artifact updates", @442756c6d233) edited `.github/workflows/scaler-release.yml` + `.github/workflows/README.md` plus host-side systemd/updater scripts under `extras/scaler/`. Under the WIDE policy `v0-shadow-wide-r2`, `protected_paths` is narrowed to exactly `.github/workflows/**`.

**Root cause / mechanism.** The `no_protected_paths` clause is a Step-1 deterministic predicate. ANY changed path matching `.github/workflows/**` makes it FAIL → early-return ABSTAIN_POLICY (`CLAUSE_FAIL:no_protected_paths`) BEFORE Step 2 verdict-parse and Step 3 challenger. No review signal (production claude review, CodeRabbit, or Devin) can change a Step-1 clause FAIL.

**How to act (efficiency).** When the PR touches `.github/workflows/**`, do NOT spend the Devin browser run — it's pure cost for zero decision impact. Still do the cheap `collect-reviews.sh` harvest first so `commit_match` evaluates to a clean PASS (otherwise commit_match reports `unevaluable`, which spuriously inflates the CLAUSE_UNEVALUABLE infra-abstain metric — that metric is driven to ~0, so don't pollute it with an ordering artifact). Then run `eval-clauses.py`, record the ABSTAIN directly (abstains are NOT critique-gated), report, stop.

**How to act (calibration — the trap).** A protected-path abstain is a POLICY abstain (system working as intended, excluded from agreement scoring, does NOT count against the infra gate). But the abstain REASON (workflow-file formality) can mask real substantive risk in the SAME PR. Here CodeRabbit flagged **Merge Risk HIGH** with 5 actionable availability comments on the host-side auto-updater (can fail to run / restart wrong services / leave services offline after a failed update) — and no production `github-actions[bot]` claude review was posted at all (fallback tier). Point the human reviewer at the substance in the Next-action bullet; don't let "just a workflow file" imply the change is low-risk.

**Fix / rule.** Protected-path abstains short-circuit — cheapest path is harvest→clauses→record, skip Devin. Always relay any harvested reviewer's severity (esp. a HIGH merge-risk / no-production-review fallback) to the human in the report even though it didn't drive the decision.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1789023811236-approver-efficiency-protected-path-github-workflow.md`_
