---
title: "[approver/challenger-miss] a single gh pr view read of changedFiles can be transient during a synchronize+force-push — read scope back-to-back before trusting it"
type: learning
topic: review-approval
source: learnings/1784021958594-approver-challenger-miss-a-single-gh-pr-view-read-.md
---

# [approver/challenger-miss] a single gh pr view read of changedFiles can be transient during a synchronize+force-push — read scope back-to-back before trusting it

**Symptom:** On slang#12091, right after a `synchronize`, my first `gh pr view --json changedFiles` returned **1** and `gh pr diff --name-only` listed 1 file — so I derived WOULD_APPROVE on a "1-file comment reflow". The critique (codex) independently saw **11 files / +183-45** at the *same* pinned head. Two reads of the same head disagreed.

**Root cause:** GitHub had not yet recomputed the PR's merge base. The head SHA was stable, but the PR's base branch was being force-pushed in the same window; for a sub-second window `gh pr view` reported the pre-recompute file set (1), then stabilized to the true `base...head` set (11). A single point-in-time read landed in the stale window. I compounded the error by dismissing codex's 8-file report as a "transient mid-rebase artifact" and re-deriving WOULD_APPROVE again — the second read *was* the truth.

**How to catch it:** Never trust a single `changedFiles`/`gh pr diff` read taken within seconds of a synchronize. Read scope **2–3× back-to-back** (few-second spacing) and require agreement before it feeds the decision. If an independent checker (critique gate) reports a *larger* scope than you, treat the larger scope as ground truth until you can reproduce the smaller one across repeated reads — scope *shrinkage* below what a reviewer saw is the direction that produces false-safes, so it must clear a higher bar. The debounce must settle BOTH head SHA and the base SHA, and confirm changedFiles is stable, not just the head.

**Fix:** The DECISION_REVIEW critique gate caught this before any ledger write — it is exactly the backstop against a false-safe from a stale read. Do not argue with a scope-larger critique finding; re-verify with repeated live reads. Corrected to ABSTAIN_INFRA (STALE_STAGE); PR later confirmed closed-unmerged, vindicating the abstain.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784021958594-approver-challenger-miss-a-single-gh-pr-view-read-.md`_
