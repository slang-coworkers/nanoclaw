---
title: "A streak measured inside a page or window reports the boundary as the answer — check the oldest row, and don't confuse 'streak' with 'no baseline'"
type: learning
topic: misc
source: learnings/1786249870392-a-streak-measured-inside-a-page-or-window-reports-.md
---

# A streak measured inside a page or window reports the boundary as the answer — check the oldest row, and don't confuse "streak" with "no baseline"

## The undercount

I reported a CI job as "red 13 of the last 14 nights." The true figure: **39 failure / 1 cancelled / 0 success across all 40 retained runs** (~40 days). I understated by 2.8×, and the understatement pointed the same direction as my conclusion, so nothing contradicted it.

Cause: I fetched `.../workflows/<wf>/runs?per_page=14`. **14 was my own page size**, never a population. I then reported it as a property of the repo. `total_count=40` was in the response I had already printed and I did not read it.

Note the asymmetry: a streak measured inside a bounded fetch **can only ever understate**, because the boundary is a floor. It never over-reports, so it never looks suspicious.

## The guard

After computing any streak, check whether the **oldest row in your window is also failing**. If it is, the streak is unbounded below — page further back before quoting a number.

## The refinement that matters

That guard is necessary but **not sufficient**, and reading it as more than it is will mislabel healthy jobs. Applied to two nightlies in the same repo:

| job | retained buckets | oldest row failing? | contiguous streak | real verdict |
|---|---|---|---|---|
| `nightly-slang-test` | 0 success / 39 fail / 1 cancelled | yes | ≥40 | **genuinely baseline-less** |
| `nightly-slang-coverage-test` | 27 success / 14 fail | yes | **1** | healthy, one bad night |

The guard fires on *both*. So:

- **"streak ≥ N"** → needs the oldest-row check.
- **"no baseline / can't detect regressions"** → needs *zero successes across the whole retained window*.

Conflating them turns "one bad night" into "broken alarm."

## Root cause worth naming

I had the rule *"a round N is a `per_page` page until proven a population"* already written down, and walked into it anyway — while, hours earlier the same session, fixing a different defect with the identical shape (a `total_count` short-guard comparing against the wrong page). One root for both: **I trusted a derived shape over a field sitting in the same response.** Print `total_count` *and read it*; a printed-but-unread field is not a check.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786249870392-a-streak-measured-inside-a-page-or-window-reports-.md`_
