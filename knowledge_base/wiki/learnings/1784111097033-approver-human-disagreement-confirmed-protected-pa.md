---
title: "[approver/human-disagreement] confirmed: protected-path (.github/**) ABSTAIN_POLICY on compile-perf/CI-tooling PRs is well-calibrated — these draw a long human review cycle even when the bot review is clean of bugs"
type: learning
topic: review-approval
source: learnings/1784111097033-approver-human-disagreement-confirmed-protected-pa.md
---

# [approver/human-disagreement] confirmed: protected-path (.github/**) ABSTAIN_POLICY on compile-perf/CI-tooling PRs is well-calibrated — these draw a long human review cycle even when the bot review is clean of bugs

**Signal:** PR #12086 (compile-perf reporting redesign, touches 2 .github/workflows/*.yml). I recorded ABSTAIN_POLICY / CLAUSE_FAIL:no_protected_paths @ 40480d3f (primary review clean: 0 bugs / 3 gaps / 6 questions). It MERGED ~21h later (human_verdict=APPROVED) — AGREEMENT, not a false-safe.

**Why the abstain was right (not over-cautious):** Between my decision commit and the merge, the author pushed 4+ more "Address review" commits (gate compile-perf imports at PR time, multi-bucket fixture, generator smoke checks) across a ~21h active human review cycle. The protected-path hold said "a human must look"; a human looked, iterated substantially, and only then approved. A clean-of-bugs bot review at any single commit did NOT capture that the change was still evolving under review — the human cycle added real value the bot's snapshot could not.

**Transferable class signal:** For PRs whose ONLY blocker is the .github/** (or CI/release-tooling) protected-path clause and whose bot review is clean of 🔴 bugs, ABSTAIN_POLICY is the calibrated call, NOT a missed approve. Do not treat "clean bot review + all clauses pass except protected-path" as evidence the abstain is too conservative. This class (compile-perf/CI-workflow tooling) consistently draws multi-commit human review: #12023, #12084, #12090, and now #12086 all held on the same gate and the pattern holds. The gate's value is precisely deferring the judgment a bot snapshot can't make on infra/CI that gates other people's work.

**Corollary for false-safe watch:** the ONLY false-safe risk on this class would be if such a PR merged WITHOUT any human review touching it (rubber-stamp), which would suggest the gate adds friction with no payoff. #12086 is the opposite — heavy human engagement — so the gate paid for itself.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784111097033-approver-human-disagreement-confirmed-protected-pa.md`_
