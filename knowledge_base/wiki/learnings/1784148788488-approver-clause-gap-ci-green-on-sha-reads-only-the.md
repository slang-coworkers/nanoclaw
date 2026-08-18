---
title: "[approver/clause-gap] ci_green_on_sha reads only the combined-status endpoint, not Actions check-runs — and the CodeRabbit exit-22 wait-then-reharvest works"
type: learning
topic: review-approval
source: learnings/1784148788488-approver-clause-gap-ci-green-on-sha-reads-only-the.md
---

# [approver/clause-gap] ci_green_on_sha reads only the combined-status endpoint, not Actions check-runs — and the CodeRabbit exit-22 wait-then-reharvest works

Context: slangpy#1065 (version-bump PR), fallback tier. Two mechanics worth recording for future slangpy approvals.

1. ci_green_on_sha scope (clause-gap awareness): eval-clauses.py evaluates `ci_green_on_sha` from `gh api repos/{repo}/commits/{sha}/status` — the COMBINED STATUS endpoint. That endpoint reflects only commit *statuses* (on slangpy: `CodeRabbit`, `license/cla`), NOT GitHub Actions *check-runs* (the build matrix: `build (linux, x86_64, gcc, ...)`, `pre-commit`, etc.). Consequence: with 6+ build check-runs still `in_progress`, the combined `state` was already `success` (both statuses green), so the clause reads PASS/green even though the actual build matrix hadn't finished. Under the relaxed policy (`require_ci_green:false`) this is moot, but if a future policy sets `require_ci_green:true` and expects "all builds green", it will NOT be enforced by this clause as written — build failures land as check-run conclusions the combined-status endpoint never sees. To actually gate on the build matrix you'd need `.../commits/{sha}/check-runs` or the statusCheckRollup. Flag if a policy tightens CI expectations.

2. CodeRabbit timing-race (exit 22) handling confirmed working: on a fresh slangpy PR, harvest-reviews.py returned exit 22 (CodeRabbit commit-status `pending`, "Review in progress") — the review body had NOT posted yet even though CodeRabbit's walkthrough issue-comment was already up. Per workflow this is a TIMING RACE, not a skip: do NOT fall to Devin-only. Waited ~90s (poll every 30s, re-harvesting each cycle); CodeRabbit status went pending→success at which point the review body posted and harvest returned exit 0 with a head-current match. Lesson: the CodeRabbit *walkthrough comment* posts minutes before the *review with inline findings* — never treat the walkthrough's presence as "review done". The exit-22 poll loop (up to ~6-7 min) is the correct primary-signal-preserving path; it saved this PR from a Devin-only fallback (Devin itself then timed out, so racing early would have meant NO_REVIEW_SIGNAL on a PR that had a perfectly good CodeRabbit review 90s later).

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784148788488-approver-clause-gap-ci-green-on-sha-reads-only-the.md`_
