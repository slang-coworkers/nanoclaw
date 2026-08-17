---
title: "[approver/challenger-miss] Re-harvest recovers head-current PRIMARY after a STALE-only first harvest (slang#12064 class, exit-10 variant)"
type: learning
topic: review-approval
source: learnings/1784166433977-approver-challenger-miss-re-harvest-recovers-head-.md
---

# [approver/challenger-miss] Re-harvest recovers head-current PRIMARY after a STALE-only first harvest (slang#12064 class, exit-10 variant)

**Symptom:** On PR #11471 (fresh post-master-merge head `0feba4d397e2`, pushed ~35s before the webhook fired), the first `harvest-reviews.py` at 01:14 returned **exit 10 (STALE ONLY)** — the newest github-actions[bot] review was against the pre-merge commit `92cc67d187aa`. Taking exit 10 at face value routes to Devin-only. But the production review CI for the new head had already *triggered* (check-run `review` started 01:08:38) and simply hadn't *posted* yet. Devin also stalled at browser launch. A Devin-only decision here would have found **zero** findings and likely produced a WOULD_APPROVE — a **false-safe**, because a re-harvest at 01:24 returned **exit 0** with a head-matching PRIMARY review carrying 🔴 **2 bugs** (both source-verified real).

**Root cause:** The exit-22 timing-race rule in the workflow is written for the "no review yet, bot still running" case (exit 22, `pending_bot` named). But the SAME race manifests as **exit 10** when a STALE review from the *previous* head exists and masks the fact that a NEW review is imminent for the current head. exit 10 is documented as "ignore stale, fall to Devin-only" — which is correct only if no fresh review is coming. On a head that is a brand-new master-merge commit, a fresh production review usually IS coming.

**How to catch it:** When harvest returns exit 10 (or 20) AND the pinned head is very recent (e.g. a master-merge commit minutes old, or the `synchronize` reason with a just-pushed head), check whether the production review workflow is *in-flight* on the head before accepting Devin-only: `gh api repos/<repo>/commits/<sha>/check-runs` — look for a `review`/claude check-run that started but hasn't posted a review, and/or `gh run list --workflow=claude-pr-review.yml --json headSha,status`. If a review run for the head recently completed/started, WAIT (~30s polls, up to ~6 min) and re-harvest — exactly the exit-22 discipline, applied to the exit-10-on-a-fresh-head case. Cheapest reliable signal: just re-run `harvest-reviews.py` after a short wait; it flips exit 10→0 once the review posts.

**Fix:** Treat "exit 10 STALE-only on a head pushed in the last few minutes" as a timing-race candidate, not a settled skip. Re-harvest before deciding. The PRIMARY review is the highest-value signal — never discard it to Devin-only on a timing artifact. (Same lesson family as [[pr-12064-decided]] and the slang#12064 harvest_used=0 miss, generalized from exit-22 to exit-10-with-stale.)

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784166433977-approver-challenger-miss-re-harvest-recovers-head-.md`_
