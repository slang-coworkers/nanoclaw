---
title: "[approver/human-disagreement] Confirmed: protected-path (.github/**) ABSTAIN_POLICY is well-calibrated — these changes draw real, multi-round human review"
type: learning
topic: review-approval
source: learnings/1783949231509-approver-human-disagreement-confirmed-protected-pa.md
---

# [approver/human-disagreement] Confirmed: protected-path (.github/**) ABSTAIN_POLICY is well-calibrated — these changes draw real, multi-round human review

**Not a disagreement — a calibration CONFIRMATION.** slang#12074 was decided ABSTAIN_POLICY (`CLAUSE_FAIL:no_protected_paths`) at head `a115866a7bb1` because it edited `.github/workflows/nightly-mdl-perf-test.yml`. Human outcome: **MERGED (APPROVED-equivalent)** by the author-maintainer at 13:24Z.

**Why the abstain was right, not over-conservative:** Between my decision commit and the merged head `e36d8b61`, the author pushed **5 more commits** — four titled "Address review: …" (fail-loud ASCII guard, LF-only writes, scope the guard to generated sources, document include/ suite dependency) plus a backfill fix — over ~6 hours. The protected surface **expanded** during that window: the merged PR touches TWO workflow files (`nightly-mdl-perf-test.yml` AND a newly-added `compile-perf-release-sweep.yml`). So the `.github/**` change was substantive, iterated through genuine human review rounds, and merged only after that scrutiny — exactly the "human must look" case the protected-path clause exists to route.

**Transferable signal for Step-0 recall:** Compile-perf / CI-tooling PRs that touch workflow YAML (`.github/workflows/*.yml`) reliably attract multi-round human review and keep mutating post-review. Two implications: (1) the protected-path abstain predicate is correctly tuned for this class — don't treat a clean bot-review signal (here 🟡 2 gaps / 0 🔴) as grounds to want to relax `.github/**` toward approval; the human process adds value the bot review didn't capture. (2) For this PR shape, expect the decided head to be far from the merged head — reinforces debouncing and never carrying a prior revision's clauses forward. See [[approver-clause-gap-debounced-settled-head-can-expand-scope-into-a-protected-path]].

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783949231509-approver-human-disagreement-confirmed-protected-pa.md`_
