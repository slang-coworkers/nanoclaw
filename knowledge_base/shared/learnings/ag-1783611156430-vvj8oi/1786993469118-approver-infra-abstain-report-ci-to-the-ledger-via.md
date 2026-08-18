---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786990775788-cvhll8
written_at: 2026-08-17T19:04:29.118Z
---

# [approver/infra-abstain] Report CI to the ledger via `gh pr checks` (current rollup), NOT raw `check-runs`; a failed production `review` automation check IS the Devin-only fallback trigger, benign to the decision

## Symptom
On slang PR #12579 (WOULD_APPROVE) my decision artifacts said "CI 29/29 green at head." The OUTPUT_REVIEW critique caught it as false and it took extra rounds to settle. Two distinct errors, both about how an approver reads CI:

1. **Truncated tally.** I ran `gh api .../commits/<sha>/check-runs` with NO `per_page` and read the first page (30 of 59 runs) as the whole set → "29/29 green." The head actually had 59 check-runs. (Generic version of this trap is already in the shared store — default page size 30, `--paginate` stops at 100 — but it bit an approver CI claim specifically.)

2. **Raw REST vs current rollup.** The raw `check-runs` REST endpoint lists SUPERSEDED historical runs. On #12579 it showed 3 failures (`review`, `board-sync`, `check-pr-label`), but `board-sync` and `check-pr-label` each had a passing RE-RUN — the CURRENT `gh pr checks` rollup was 51 pass / 3 skipping / 1 fail. Codex (reading raw REST) itself tripped on this and demanded I "disclose 3 failures"; the current rollup refuted it.

## Root cause / the approver-specific insight
The single persistent failure on #12579 was the `review` check = **"Claude PR Review"** (`.github/workflows/claude-pr-review.yml`) — the PRODUCTION review automation itself erroring out. That failure is EXACTLY why `collect-reviews.sh` returns exit 20 (no primary review to harvest) and the workflow falls to the Devin-only tier. So a red `review` check on a reviewable PR is the NORMAL, expected fallback-tier signal — NOT a code concern and NOT a reason to abstain. Don't conflate "the review bot's own job failed" with "a build/test regression."

## How to catch it / fix (transferable rule)
- For the CI status an approver puts in the ledger/decision, use `gh pr checks <pr> --repo <repo>` (the de-duped CURRENT rollup), NOT raw `check-runs`. If you must use the REST endpoint, pass `?per_page=100`, check `.total_count`, and de-dup superseded runs by name (keep the latest per check) before tallying.
- Time-pin the CI claim ("current gh pr checks rollup, re-verified <ISO ts>") — CI is a moving target across critique rounds, and a reviewer re-checking later will see a different raw-REST picture.
- When harvest returns exit 20 on a normal (non-fixer, non-bot) PR, check WHY: a failed/errored production `review` check-run explains the absent primary review and confirms the Devin-only fallback is correct — it is not itself a defect in the PR. require_ci_green:false under v0-shadow-wide means none of this gates the decision anyway.
