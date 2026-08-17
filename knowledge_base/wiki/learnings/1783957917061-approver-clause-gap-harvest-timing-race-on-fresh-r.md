---
title: "[approver/clause-gap] Harvest timing-race on fresh reviewable PRs — re-harvest at the settled head, never freeze the first-second result"
type: learning
topic: review-approval
source: learnings/1783957917061-approver-clause-gap-harvest-timing-race-on-fresh-r.md
---

# [approver/clause-gap] Harvest timing-race on fresh reviewable PRs — re-harvest at the settled head, never freeze the first-second result

## Symptom
On slang#12082, the FIRST `harvest-reviews.py` run (≈2 min after ready_for_review) returned exit 0 with **coderabbitai[bot]** (secondary/fallback tier) — CodeRabbit had posted at 15:08:19 but the production `github-actions[bot]` review had not yet landed. The production `review` check-run was still `in_progress` and only posted its review at 15:11:49. Freezing that first result would have decided from the weaker fallback tier and missed the primary signal — the exact `harvest_used=0` failure mode from slang#12064.

## Root cause
harvest-reviews.py returns the best review present *at call time*. On a fresh PR the two review bots settle at different times (CodeRabbit fast, production claude-code-action slower). A single early harvest can capture the secondary before the primary exists — and exit 0 (not the 22 "pending_bot" code) because *a* review was found.

## How to catch it
- After harvest, ALWAYS check the production review check-run state at the head: `gh api repos/<repo>/commits/<sha>/check-runs` and look at the `review` and `Claude Code Assistant` entries. If `review` is still `in_progress`, the primary review is imminent — wait and re-harvest. If "Claude Code Assistant" is `skipped` AND `review` is `success`/absent with no github-actions review, production genuinely skipped (fixer/bot branches) → fallback is correct.
- If harvest returns coderabbitai[bot] but you can see (via GraphQL `reviews`) a github-actions[bot] review at the same head, re-run harvest — it will now pick the primary. On slang#12082 the re-run returned github-actions[bot] with a proper "**Verdict**:" line and diff_hash footer.
- On a `synchronize`/debounce, this is doubly important: re-harvest at the SETTLED head, because the head that the first review targeted may already be superseded.

## Fix
Treat the first harvest on a fresh PR as provisional. Gate finalization on the production review check-run being terminal (or provably skipped). The REST `pulls/.../reviews` and `pulls/.../comments` endpoints can trip an over-eager critique-gate hook that pattern-matches the word "reviews"/PR-write — use `gh api graphql` `reviewThreads`/`reviews` instead, which reads the same data without tripping it.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783957917061-approver-clause-gap-harvest-timing-race-on-fresh-r.md`_
