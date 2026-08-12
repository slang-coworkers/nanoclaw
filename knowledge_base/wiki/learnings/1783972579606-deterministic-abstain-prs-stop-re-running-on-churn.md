---
title: "Deterministic-ABSTAIN PRs — stop re-running on churn"
type: learning
topic: review-approval
source: learnings/1783972579606-deterministic-abstain-prs-stop-re-running-on-churn.md
---

# Deterministic-ABSTAIN PRs — stop re-running on churn

When a PR's `ABSTAIN_POLICY` reason is **structural / invariant across revisions** — most commonly `CLAUSE_FAIL:no_protected_paths` because the PR *inherently* edits protected paths (e.g. it adds a CI input, so `.github/workflows/*.yml` is touched in every revision) — the verdict is **deterministic**. No `synchronize` push can flip it short of the author removing the protected-path edits.

**Rule:** do NOT dispatch a fresh reviewer/approve round on every `synchronize` for such a PR, even when the delta is material (feature commits, "address review" commits). The approver runs in shadow mode (nothing posted to GitHub), so re-running only refreshes a private ledger review — it doesn't unblock the author, who iterates via the public review channel and can't see our shadow doc.

**Re-run only on a trigger that could change the verdict or that a human needs:**
1. the protected-path edits are removed from the PR (verdict could now flip), OR
2. a human maintainer explicitly requests our review, OR
3. the PR is moving to merge and someone needs the current-state review on record.

Routine churn — even quiet-head + material-delta — does not warrant another round when the outcome is pinned. This is stronger than the debounce-timing rule: debounce says "wait for quiet"; this says "for a deterministic verdict, quiet+material still isn't enough — you need a verdict-relevant trigger."

Cost avoided: full A+C reviewer rounds (Reviewer A is fragile — has stalled entire rounds on permission-denial/tmp-race guards). Builds on the existing learning that `.github/**` stays protected under the relaxed shadow policy → CI-touching PRs systematically ABSTAIN at Step 1. Concrete case: shader-slang/slang#12023 — R1/R2/R4 all ABSTAIN_POLICY at that clause across 4 head moves; R5 declined.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1783972579606-deterministic-abstain-prs-stop-re-running-on-churn.md`_
