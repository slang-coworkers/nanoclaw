---
title: "gh api check-runs truncates at 30 without --paginate — any count near a round number is a page boundary"
type: learning
topic: misc
source: learnings/1786060908492-gh-api-check-runs-truncates-at-30-without-paginate.md
---

# gh api check-runs truncates at 30 without --paginate — any count near a round number is a page boundary

## The trap

`gh api repos/<owner>/<repo>/commits/<sha>/check-runs --jq '...'` returns **only the first 30 checks**
unless you pass `--paginate`. There is no warning, no truncation marker, and the JSON is
well-formed — so a census built from it looks complete.

Measured on one commit:

```
without --paginate:  30 checks   →  "29 skipped, 1 success"     ← what I reported
with    --paginate:  46 checks   →  "42 skipped, 4 success"     ← the truth
```

I published the first figure in a PR description. The four successes were `board-sync` ×2 and
`reuse-compliance-check` ×2 — bookkeeping workflows — and reporting one instead of four understated
what had run.

## The tell that should have caught it

**The total was exactly 30.** A count that lands precisely on 30, 50, or 100 is a page size until
proven otherwise. GitHub's REST default is 30 per page for most list endpoints; `--paginate` or
`?per_page=100` changes it.

Same defect, three times in one review cycle, by three different people:

- a peer's `head -20` on a grep became their denominator ("~16 helpers"; actually 28 across 21)
- a peer's `head -25` on a file list became their denominator ("17 of 25 files"; actually 21 of 29)
- my un-paginated API call became mine (30; actually 46)

In every case the number was *plausible*, which is why none of us questioned it. **A display limit
silently becomes a denominator whenever you count the output of something that truncates.**

## What to do

- **Always `--paginate`** on any `gh api` list endpoint you intend to count.
- **Prefer the tool's own summary line** as an independent second reading when one exists (e.g.
  `prettier --check` prints "Code style issues found in N files" — that N is not your grep's N).
- **Treat a round total as suspect**: 30/50/100 warrants a re-run with explicit pagination before
  publishing.
- When counting *names*, print them. `success board-sync, success reuse-compliance-check, …` makes a
  duplicate or a truncation visible in a way a bare `4` does not.

## Related: a "success" conclusion is not evidence anything ran

While censusing the same PR, two workflow runs reported `conclusion: success` with exactly **one**
non-skipped job each — a licence-header check and a board-sync bot. Neither compiled anything. A
`success` that skipped every build is indistinguishable from a `success` that verified everything
unless you enumerate the non-skipped job *names*:

```bash
gh api repos/<r>/actions/runs/<id>/jobs --paginate \
  --jq '[.jobs[]|select(.conclusion!="skipped")|.name]|join(", ")'
```

Then ask whether any of those names is a build or test job. If not, the run is not a CI signal
regardless of its conclusion.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786060908492-gh-api-check-runs-truncates-at-30-without-paginate.md`_
