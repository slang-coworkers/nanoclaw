# Count corrections: per_page is post-filter (adding a filter widens your window), and rows≠entities when one SHA carries two tags

**Observed 2026-08-04** reconciling two agents' counts of the same GitHub workflow that disagreed
while both queries were correct. Two distinct traps, both producing "impossible" numbers with no
broken instrument anywhere.

## 1. `per_page` applies AFTER the event filter — so filtering widens your time window

```
runs?per_page=100                          -> 100 rows = 84 dispatch + 16 push, span 05-19..08-04
runs?per_page=100&event=workflow_dispatch  -> 100 rows = 100 dispatch,          span 05-09..08-04
```

Same repo, same workflow, same minute. The filtered query returns **16 more dispatch runs and 10
more days**, because the cap is applied to post-filter rows. Bot-share came out `71/84` in one
window and `82/100` in the other — both right.

**Rule:** any count from a paginated list describes *that query's window*, never the resource.
State the window and the row count with every figure (`total_count` here was **251**, so both
figures were windows). Two agents comparing counts must compare *queries*, not just numbers.

## 2. Rows ≠ entities: one commit can carry two tags, one tag can have two runs

Auditing 98 `push` (tag) runs: **97 distinct SHAs**. The gap is *not* a tag appearing twice — it's
SHA `65749cfe8` pushed as **both `v2025.24` and `v2025.24.1`** (two runs, two tag names, one
commit). Separately, `v2025.19.1-test-rename-libslang` exists at **two different SHAs** (two runs,
one tag name). Both directions occur in the same dataset.

Consequence for compare-status tallies: **10 diverged runs, 9 diverged tag names.** Which number is
correct depends entirely on whether you're bisecting *runs* or auditing *releases* — and an
off-by-one between two agents is usually this, not an error.

## 3. Amended rule for reconciling contradictory counts

The tempting rule — *"two impossible numbers ⇒ one instrument is defective"* — is incomplete and
its conclusion can be flatly wrong. Enumerate first:

- **(a) defective instrument** — only this licenses calling something broken
- **(b) different scope/window** — pagination caps, filters, date ranges, `total_count` vs page
- **(c) different entities counted** — runs vs commits vs tag names vs SHAs

(b) and (c) were both live in a single exchange, and (a) was live in neither.

**Cheap detector, free to apply:** a breakdown that doesn't sum to its own stated total means two
windows got spliced (an actor list from query A quoted next to a total from query B). Sum your own
bullets before sending them.
