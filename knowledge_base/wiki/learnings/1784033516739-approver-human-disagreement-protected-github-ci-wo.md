---
title: "[approver/human-disagreement] Protected .github/** CI-workflow PRs: ABSTAIN_POLICY is the right call and merges confirm it (agreement-neutral, not false-safe)"
type: learning
topic: review-approval
source: learnings/1784033516739-approver-human-disagreement-protected-github-ci-wo.md
---

# [approver/human-disagreement] Protected .github/** CI-workflow PRs: ABSTAIN_POLICY is the right call and merges confirm it (agreement-neutral, not false-safe)

**Confirmed-safe pattern (R0 call matched the human outcome).**

**Shape:** A trusted maintainer (COLLABORATOR/OWNER) opens a small, well-scoped PR that fixes a real bug BUT also edits a CI workflow under `.github/**` (here: `.github/workflows/ci-slang-sanitizer.yml`, part of an ASan merge-queue fix). The reviewer verdict is clean-ish (APPROVE_WITH_NITS, 0 bugs). It is tempting to lean toward WOULD_APPROVE because the code fix itself is correct and the author is trusted.

**Correct call:** ABSTAIN_POLICY / CLAUSE_FAIL:no_protected_paths. The `no_protected_paths` clause fails the instant any changed path matches `.github/**` (mounted v0-shadow-relaxed still protects `.github/**` and `**/slang-tag-version.h`). A clause FAIL is terminal — the challenger never runs, the review verdict never upgrades it. This is the system working as intended: CI-workflow changes need a human to look, because a workflow edit's blast radius (merge-queue gating, security of the runner, what gets built/preloaded) is not something shadow-mode auto-scope covers.

**Calibration:** PR #12060 MERGED at exactly the reviewed head by the maintainer ⇒ APPROVED-equivalent human verdict. Because my decision was ABSTAIN (not WOULD_APPROVE), this is **agreement-neutral (ABSTAIN rows are excluded from agreement scoring), NOT a false-safe.** A correct "human must look" that a human then actioned. This matches the terminal-ABSTAIN-then-merged pattern already seen on #12084, #12023, #12090 — protected-path abstains are consistently vindicated by the human merging with the protected file intact.

**How to catch it (for the NEXT R0 of similar code):** the moment eval-clauses.py reports `no_protected_paths: fail`, stop — that's the decision. Don't let a clean review verdict, a trusted author, or a "the code fix is obviously right" gut feeling pull you toward approve. The protected-path clause exists precisely to override those. Do still read the review doc's gaps for the calibration learning, but they cannot move a clause-fail abstain. Relates to [[debounce-pr-review-on-churn]].

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784033516739-approver-human-disagreement-protected-github-ci-wo.md`_
