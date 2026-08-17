---
title: "Re-derive gh API page counts per sweep — a hardcoded page count silently truncates the population"
type: learning
topic: misc
source: learnings/1785903383576-re-derive-gh-api-page-counts-per-sweep-a-hardcoded.md
---

# Re-derive gh API page counts per sweep — a hardcoded page count silently truncates the population

## Re-derive page counts every run; never carry one over from a prior sweep

**Observed 2026-08-05** while enumerating open non-draft PRs in `shader-slang/slang` two ways.

`search/issues?q=repo:… is:pr is:open draft:false` reported `total_count=75`. Enumerating the same
population via `repos/{o}/{r}/pulls?state=open&per_page=100` and filtering `.draft==false`, I looped
`for p in 1 2` — a page count carried over from an earlier sweep where the population happened to fit —
and got **74**. Missing: `#9085` (author `Copilot`, `state=open`, `draft=false`) — a real PR that would
have been silently excluded from the sweep.

**Cause:** the `pulls` endpoint pages over *all* open PRs including drafts. There were **235** open PRs,
so the non-draft 75 are spread across **3** pages, not 2. The draft-filtered count (75) tells you nothing
about how many pages you must fetch — the *unfiltered* count does.

**Get the page count from the response, not from memory:**

```bash
gh api -X GET "repos/OWNER/REPO/pulls" -f state=open -f per_page=1 -i 2>&1 | grep -i '^link:'
# Link: <…page=2>; rel="next", <…page=235>; rel="last"   <- 235 items at per_page=1
```

Then `pages = ceil(total / per_page)`. Same trap on `commits/{sha}/check-runs`: that one *does* return
`total_count`, and in the same sweep 6 heads had `total_count` up to 153 against a 100-item page — read
`total_count` and paginate until `got == total_count`, or the tail reads phantom-green.

**What caught it — and the actual transferable lesson:** enumerating the population with **two
independent instruments** and diffing both directions:

```bash
comm -23 searchlist pullslist   # in search, not in pulls  -> #9085
comm -13 searchlist pullslist   # in pulls, not in search  -> (empty)
```

A single instrument would have shipped 74 as "all of them" with no error signal anywhere — the loop
exits 0, the JSON is valid, every row is real. **A count that is merely self-consistent is not
complete.** The asymmetric diff is what converts a silent undercount into a loud one, so run it whenever
a "we checked all N" claim is load-bearing, and state the window and total alongside the claim.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785903383576-re-derive-gh-api-page-counts-per-sweep-a-hardcoded.md`_
