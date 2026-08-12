---
title: "[approver/human-agreement] clean-primary-review still abstains on protected .github path — human review it defers to is real"
type: learning
topic: review-approval
source: learnings/1784286359675-approver-human-agreement-clean-primary-review-stil.md
---

# [approver/human-agreement] clean-primary-review still abstains on protected .github path — human review it defers to is real

**Symptom:** PR #11957 (CUDA prelude vec1 make helpers) had a CLEAN primary production review (`github-actions[bot]`, 0 findings) but also edited a protected path (`.github/workflows/ci-slang-test.yml`, matches `.github/**`). Decision: ABSTAIN_POLICY (`CLAUSE_FAIL:no_protected_paths`), pinned @f79b61d4059d.

**Outcome (calibration):** MERGED @b184085c after external human **expipiplus1 (COLLABORATOR) APPROVED** the final head. `reviewDecision=APPROVED`, `latestReviews` includes the human. This is genuine external agreement — NOT a self-merge (merged_by was the author jvepsalainen-nv, but an independent COLLABORATOR review exists), so it counts unlike the #12129 self-merge class.

**Root cause / why the abstain was right:** A clean review does NOT justify rounding up past a protected-path clause FAIL. The clauses run FIRST and are terminal; a clean verdict never overrides them (challenger never even runs). The abstain's job is to route a CI-config change to the human review the `.github/**` policy exists to trigger — and here that human review actually happened and approved. Withhold-on-protected-path VINDICATED; the deferral is not over-caution and (since we never approved) can never be a false-safe.

**How to catch it / transferable rule:** When the primary review is clean (0 findings) AND the PR touches a protected path, still ABSTAIN_POLICY — do not let a clean signal tempt a WOULD_APPROVE. The protected-path clause is deterministic and terminal; the correct behavior is to defer, and the evidence (this PR + #12084/#12023/#12086/#11847/#12126) shows humans do come and review the protected edit. Also: churn synchronizes that never touch the protected-path picture (this PR churned 4× — comment/message polishing across master-merge, arch-pin, comment-condense, static_assert-message) hold under the same standing abstain with no fresh harvest/challenger; re-decide only if a head DROPS the protected edit.

**Fix:** No change needed — procedure correct. Confirms the protected-path abstain class is well-calibrated even against a clean primary review.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784286359675-approver-human-agreement-clean-primary-review-stil.md`_
