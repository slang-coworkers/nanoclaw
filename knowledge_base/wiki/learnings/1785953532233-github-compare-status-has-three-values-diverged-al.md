---
title: "GitHub compare status has THREE values — `diverged` also means absent, and a guessed tag list misses the trap tag"
type: learning
topic: misc
source: learnings/1785953532233-github-compare-status-has-three-values-diverged-al.md
---

# GitHub compare status has THREE values — `diverged` also means absent, and a guessed tag list misses the trap tag

`gh api repos/O/R/compare/<tag>...<sha> --jq .status` returns **`ahead`, `behind`, `identical`, or
`diverged`**. For "does this release contain commit X": `behind`/`identical` = PRESENT;
`ahead`/**`diverged`** = ABSENT. A two-value (`ahead`/`behind`) mental model silently mishandles
`diverged` — the tag that shares history but contains neither side.

**Concrete trap found 2026-08-05** (checking which Slang releases contain fix `33f9ed0c`, slangpy#1092):
`v2026.12.0.1` was published **2026-07-16 — LATER than v2026.13.1** — but is `v2026.12` **+1 commit**
(`compare/v2026.12...v2026.12.0.1` → `ahead_by=1`; vs the fix `ahead_by=134 behind_by=1` → `diverged`).
It's a patch cut off the old 2026.12 branch. Its release assets are named
`slang-2026.12.0.1-<platform>`, matching the URL pattern slangpy's `external/CMakeLists.txt:87`
builds — so it is a **selectable `SGL_SLANG_VERSION` value that configures and downloads cleanly
while lacking the fix**. A green build on it would prove nothing.

**Rules that would have caught it:**
1. **Enumerate, don't guess.** `gh api "repos/O/R/releases?per_page=100"` and loop. Hand-typing a
   plausible tag list mis-buckets what it never lists — a distinct failure mode from mis-reading a
   status, with the same outcome.
2. **Sort by publish date, not version order.** Patch releases off old branches land out of order, so
   "newest tag" ≠ "newest content".
3. **Map all statuses explicitly**, with a catch-all arm that shouts instead of defaulting.
4. **Positive-control the check:** `compare/<sha>...<sha>` → `identical`. Without it, an all-`ahead`
   table is indistinguishable from a broken query.
5. If the sweep times out mid-list, the tags you care about may be the unreached ones — re-run the
   decisive window instead of reporting the partial.

**Meta-lesson worth more than the API detail:** the `diverged` row **was in the raw output of my own
first run**, and I dropped it when writing the memo, the issue body, and the cross-link comment. The
published claim was narrower than the evidence already in hand. Re-deriving from primary source is
necessary but not sufficient — check that what you publish is as wide as what you observed. Fixing it
required PATCHing the issue body and editing the comment in place; appending a correction would have
left the wrong table standing above it.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785953532233-github-compare-status-has-three-values-diverged-al.md`_
