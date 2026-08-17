---
title: "[approver/clause-gap] ci_green_on_sha passes on legacy combined-status even when real build/slang-test CI never ran (conflicting/diverged PR)"
type: learning
topic: ci-tooling
source: learnings/1784017419889-approver-clause-gap-ci-green-on-sha-passes-on-lega.md
---

# [approver/clause-gap] ci_green_on_sha passes on legacy combined-status even when real build/slang-test CI never ran (conflicting/diverged PR)

**Symptom.** On shader-slang/slang#12089 the `ci_green_on_sha` eligibility clause returned PASS ("combined status=success @ <sha>") even though the actual Slang build + slang-test suite (`ci.yml`, event=`pull_request`) had **never executed on the PR head**. All 6 clauses passed and the review-doc verdict was APPROVE_WITH_NITS — a whisker from a false WOULD_APPROVE on a change whose two new `.slang` tests and core-module ABI edit were entirely CI-unverified.

**Root cause.** `eval-clauses.py` computes `ci_green_on_sha` from the **legacy combined-status API** (`repos/{repo}/commits/{sha}/status`), which only aggregates *commit-status contexts*. On this repo those were 3 trivial signals (license/cla, CodeRabbit, SlangPy-trigger) — all green — while the real build/test runs report as **check-runs** (a different surface) and simply weren't present. The PR was `CONFLICTING` and ~228 commits behind master (diverged), so GitHub couldn't compute the merge ref that `pull_request`-triggered CI needs → the build/test workflow never dispatched. Combined-status green ≠ "the build and tests passed."

**How to catch it (challenger checklist for any WOULD_APPROVE candidate).**
1. Don't trust `ci_green_on_sha` alone. Independently check that the repo's *real* build/test workflow actually ran on the head:
   `gh api "repos/{repo}/actions/runs?head_sha={sha}&per_page=30" --jq '.workflow_runs[]|"\(.name) \(.event) \(.status)/\(.conclusion)"'`
   If only `pull_request_target` jobs (PR Maintenance, trigger jobs) appear and the main `CI`/build/slang-test workflow is ABSENT → the change is CI-unverified.
2. Check mergeability + divergence: `gh pr view <pr> --json mergeable,mergeStateStatus` and `gh api repos/{repo}/compare/master...{sha} --jq '{ahead:.ahead_by,behind:.behind_by,status:.status}'`. `CONFLICTING`/`diverged`/deeply-behind is both a human-must-look signal on its own AND the usual reason `pull_request` CI silently didn't run.
3. Cross-check `commits/{sha}/check-runs` (not just `/status`) — the real signal often lives there.

**Fix / disposition.** Correct call was ABSTAIN_POLICY / CHALLENGER_CONCERN (not WOULD_APPROVE, not BLOCK — no verified bug; not ABSTAIN_INFRA — a valid CodeRabbit review was harvested so pipeline completed). The gap is in the PR's state = system working as intended. Procedure improvement to consider: `ci_green_on_sha` should treat "no build/test check-run present on head" as UNEVALUABLE rather than leaning on combined-status green, especially for PRs in a non-mergeable/diverged state. Relates to [[approver/false-safe]] patterns — combined-status-green is a classic false-safe source.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784017419889-approver-clause-gap-ci-green-on-sha-passes-on-lega.md`_
