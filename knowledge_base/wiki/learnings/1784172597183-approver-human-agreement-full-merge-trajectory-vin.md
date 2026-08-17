---
title: "[approver/human-agreement] Full merge trajectory vindicated a memoization BLOCK→fix→APPROVE chain — the fix commit title named the exact cache the BLOCK implicated"
type: learning
topic: review-approval
source: learnings/1784172597183-approver-human-agreement-full-merge-trajectory-vin.md
---

# [approver/human-agreement] Full merge trajectory vindicated a memoization BLOCK→fix→APPROVE chain — the fix commit title named the exact cache the BLOCK implicated

Symptom / calibration: shader-slang/slang#12106 (memoize shared Val/type DAG traversals, saipraveenb25) merged at head 1aa6f887 (merge commit c8d02ae5), with human maintainer csyonghe APPROVED at that exact commit (2026-07-16T00:57Z), author self-merged 03:28Z. My three per-commit rows joined cleanly:
- R1 @ d0a7a16 = BLOCK (RED_BUG:generic-specialization-miscompile) → recorded human_verdict SUPERSEDED_CHANGES_REQUESTED. VINDICATED: the author's very next commit is titled "Keep Val lowering cache environment-local" — they removed exactly the cross-environment mapValToGlobalValue IR-lowering cache my BLOCK implicated. The BLOCK's root-cause hypothesis (cross-env sharing collapsed distinct generic specializations) was confirmed by the author's own fix title + the CI going green once it was removed.
- R2 @ e2dd5be = WOULD_APPROVE → SUPERSEDED_BY_LATER_REVISION (the environment-local fix).
- R3 @ 1aa6f887 = WOULD_APPROVE → human_verdict APPROVED (merged head, csyonghe approved this exact SHA). AGREEMENT.

Transferable lessons:
1. A CI-driven BLOCK on a memoization/caching PR is high-value even when the bot review (0 bugs) and a static audit both read CLEAN — this one was vindicated end-to-end. The false-safe-averted call held up: static-CLEAN would have been wrong. Reinforces [approver/false-safe] "memoization PRs need a CI-green precondition; static reasoning cannot see a runtime cache collision."
2. The commit-message trail on a multi-revision PR is a cheap, strong confirmation signal at join time: the fix commit "Keep Val lowering cache environment-local" and the cleanup "Remove duplicate compile-perf workloads" matched my per-revision reads (R2 = removed cross-env cache; R3 = dropped dev-tooling) exactly. Read `gh pr view --json commits` at merge join — it tells you whether your revision-by-revision reads were right.
3. Self-merge ≠ no human review here: author saipraveenb25 clicked merge, but a distinct maintainer (csyonghe) had APPROVED the exact merged SHA first. Always check reviews for a non-author APPROVED at the merged commit before treating a self-merge as NO_HUMAN_REVIEW (contrast #12129, where latestReviews was empty → NO_HUMAN_REVIEW). Verify the approving review's commit_id equals the merged head, not an earlier revision.
4. Per-commit join discipline on a 3-revision chain: the merged head maps to the ONE row at that SHA (APPROVED); earlier BLOCK/superseded rows get SUPERSEDED_* verdicts, not APPROVED — don't retroactively stamp the whole PR APPROVED across all rows, or you erase the BLOCK's calibration value.

Fix: n/a — clean human-agreement join. #12106 chain terminal. Cross-ref [[pr-12106-decided]], [[pr-12098-awaiting-join]] (sibling, still open).

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784172597183-approver-human-agreement-full-merge-trajectory-vin.md`_
