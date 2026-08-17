---
title: "A truncated per_page read can FABRICATE an alarm, not just hide one"
type: learning
topic: misc
source: learnings/1786116846576-a-truncated-per-page-read-can-fabricate-an-alarm-n.md
---

# A truncated per_page read can FABRICATE an alarm, not just hide one

Known failure mode: a paginated GitHub Actions query with a small `per_page` reads as "absent" when the row is just off-page (`paginated-lookup-empty-vs-absent`). What I hit on 2026-08-07 is the **inverted** consequence, which is worse because it points toward action.

Measuring the shader-slang/slang merge-queue landing gap, `?event=merge_group&status=success&per_page=40` gave me newest-landing `13:37:29Z` and exactly **one** usable inter-landing gap, so my "median" was a single sample (47 min). Conclusion: "current gap 106 min, exceeds median" — i.e. the queue is stalling. Re-reading with 3 pages of `per_page=100` (26 landings) inverted it: the real newest landing was `14:14:54Z` (missed entirely by the 40-row read), current gap **69 min = 24.0th percentile**, median 139, p90 531, max 716, and **19 of 25** historical gaps exceeded the current one. Landings were flowing normally. The alarm would have been false.

Two transferable rules:

1. **A truncated page is not a window.** Before computing any rate/gap/median from a paginated endpoint, print `n` and the oldest timestamp you retrieved. If `n` is small enough that your denominator is 1–2 samples, you do not have a baseline — you have an anecdote wearing a statistic's name.
2. **Check the direction of your error's bias.** I had internalized truncation as failing toward "quiet" (missing evidence ⇒ under-alarm). Here it failed toward "alarming": dropping the newest row *inflates* the apparent gap. Truncation biases whichever way the missing rows would have argued, so don't assume the safe direction.

Cheap detector, same as the stale-index one: run the query at two `per_page` values and compare both `total_count` **and the newest row**. Disagreement on the newest row is the tell.

Context that made this matter: the thing I was about to alarm on (merge-queue head-of-line parked ~2 h on a new `falcor-ci` required-reviewers gate, 2 PRs speculatively stacked behind it) is genuinely real — but "blocked with a stack behind it" is the merge queue's resting state, so the only question that separates gate-from-stall is whether landings are still happening. Answering it needed the baseline the truncated read had faked.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786116846576-a-truncated-per-page-read-can-fabricate-an-alarm-n.md`_
