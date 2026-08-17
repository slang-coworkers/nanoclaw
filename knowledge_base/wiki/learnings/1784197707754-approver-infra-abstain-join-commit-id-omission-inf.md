---
title: "[approver/infra-abstain] JOIN: commit_id-omission infra-abstain (slang#12055) merged-APPROVED at exact decided head, gap merged over — the staging defect cost a decision on a clean PR"
type: learning
topic: review-approval
source: learnings/1784197707754-approver-infra-abstain-join-commit-id-omission-inf.md
---

# [approver/infra-abstain] JOIN: commit_id-omission infra-abstain (slang#12055) merged-APPROVED at exact decided head, gap merged over — the staging defect cost a decision on a clean PR

# [approver/infra-abstain] calibration JOIN — the missing-commit_id abstain masked a clean human-approve

**Closes the loop on slang#12055** (see companion learning "[approver/infra-abstain] reviewer-coworker review-doc omits contract-required commit_id + _approver_result"). My R0 decision was **ABSTAIN_INFRA / CLAUSE_UNEVALUABLE:commit_match** @6580f014 (co-defect: Devin lost to teardown, reviewers_complete=false).

**Join outcome (verified live, not from the webhook alone):** PR **MERGED @ e3a6efd7** by jkwak-work at my **EXACT decided head 6580f014 — zero follow-up commits**. `reviewDecision=APPROVED`; pdeayton-nv formally APPROVED at 6580f014. The 🟡 test-durability gap I flagged (counterfactually) was left **unaddressed and merged over**. Recorded human_verdict=APPROVED.

**Why this matters (two transferable signals):**

1. **An infra-abstain whose ONLY blocker is a staging-format defect is masking a clear outcome — the cost is real, and it lands on CLEAN, mergeable PRs.** Here the PR was substantively clean (challenger-verified principled + lifetime-safe), the review said APPROVE_WITH_NITS, and the human approved+merged at my exact head with no changes. The abstain existed PURELY because the staged reviewer-coworker result block omitted `commit_id`/`_approver_result` (commit_match unevaluable) and Devin was lost. ABSTAIN_INFRA is excluded from agreement scoring, so this is NOT a false-safe — but it IS a decision the pipeline denied me on a PR with an unambiguous approve outcome. **Priority signal: fix the Verity handoff to stamp the full contract-required result block; every reviewer-coworker-path PR is currently abstaining on commit_match, and here that directly cost a would-have-been-substantive decision.**

2. **Calibration (adds to the #12037/#12041/#12064 cluster):** a single LOW-severity test-durability/robustness gap (regression's value hinges on unguarded fixture state — here an invisible leading BOM byte with no `.gitattributes` guard) on an otherwise-clean, principled producer-side fix from a trusted author is **high-probability human-approve-and-merge**. The maintainer merged over it without pinning the fixture encoding. So even the counterfactual "intact pipeline → ABSTAIN_POLICY:OPEN_GAP" would have been a **withhold-on-SAFE** (conservative, correct-by-design), not a false-safe. When flagging this gap class, frame the abstain as low-concern-conservative, not "PR is risky."

**Also confirmed:** the debounce/byte-identity discipline paid off for the JOIN — pinning to the settled master-merge head 6580f014 (after byte-proving PR-own code identical across the merge) meant the ledger row joined cleanly to the human verdict at the exact same SHA. Had I pinned to the reviewed 0a1da47 instead, the join would have been messier.

**Verify-join-first held:** the webhook said merged; I confirmed via live `gh pr view` (merge commit, mergedBy, head=6580f014, reviewDecision=APPROVED, zero follow-up commits) before stamping — per the [[pr-12117-decided]] spurious-join anchor.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784197707754-approver-infra-abstain-join-commit-id-omission-inf.md`_
