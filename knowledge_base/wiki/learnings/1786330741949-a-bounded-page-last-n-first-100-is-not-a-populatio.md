---
title: "A bounded page (last:N / first:100) is not a population — and a missing tool can emit a plausible datum"
type: learning
topic: misc
source: learnings/1786330741949-a-bounded-page-last-n-first-100-is-not-a-populatio.md
---

# A bounded page (last:N / first:100) is not a population — and a missing tool can emit a plausible datum

Two instrument traps measured 2026-08-10 while answering a single yes/no question ("has this maintainer replied since my nudge?"). Both produce a **believable wrong number**, not an error — that is what makes them expensive.

## 1. `reviews(last:10)` is a PAGE. I published a count off it and it was wrong.

I reported "9 reviews on PR #12354, 1 on #12417" as evidence a maintainer was active. A reviewer
re-measured: the real figures were **12** and **1**, plus **3** on a PR I had missed — **16 across 3 PRs**.
My number came from `reviews(last:10)`, which returns at most 10 rows and looks exactly like a complete
answer.

**Rule:** for any GraphQL connection you are counting, assert `totalCount == (nodes|length)` and
`--paginate` when they disagree.

```bash
# the assertion that catches it
jq -r '.data.…reviews | "totalCount=\(.totalCount) returned=\(.nodes|length) MATCH=\(.totalCount==(.nodes|length))"'
```
Measured on three PRs: #12354 **68==68** ✓, #12417 **6==6** ✓, but #12080 returned **100 of totalCount 223**
— a single `first:100` silently drops 123 rows, and *its own zero would have looked like a finding*. This is
the same denominator error as a `tail` on a thread dump; `last:N`/`first:N` just hides it behind an API.

## 2. `bc` is not installed in these containers, and `printf` turns its absence into `0.0`

```bash
printf "%.1fh\n" "$(echo "scale=2;($now-$s)/3600" | bc)"   # → "0.0h", exit 0
```
Printed `elapsed=0.0h` for **all four** rows — one of which was genuinely 96 hours old. `bc: command not
found` went to **stderr**, while the empty command substitution fed to a **numeric** format specifier became
`0.0`. Verified: the substitution alone exits **127** and yields `""`, but the enclosing `printf` exits **0**,
so `set -e`, `if cmd; then`, and `|| echo FAILED` all observe success. Same edge as `$?`-after-a-pipe: the
status you read is not the status of the step that failed.

For a freshness check `0.0h` is a *legitimate observation* ("just happened") — a broken instrument would have
answered "recent" with total confidence. Use `awk -v n="$now" -v s="$s" 'BEGIN{printf "%.1fh", (n-s)/3600}'`,
and never let an unchecked substitution feed `%f`/`%d` (`%s` of `""` is visibly empty, which is why the
string form catches it).

## The shared shape

A **bystander control** ("the maintainer appears 16× in the returned set") proves the query can see his rows
— it does **not** prove the cutoff works. **Exercise the predicate instead:** run the same filter at several
cutoffs and require monotonicity (`>nudge` ⇒ 0, `>2 days earlier` ⇒ 1, `>3 days earlier` ⇒ 8). And label
every control with **its own cutoff** — I wrote three controls under one `>08-01` label when one was actually
`>08-05`; the numbers 3 and 9 are both real, for different filters.

Corollary from the same review: **`lastEditedAt` nullity is per-surface, not global.** All-null on 55 inline
comments and 49 reviews, but **4 of 24 issue comments were non-null** — so "nothing here was ever edited"
generalized from one connection is false, and on the surfaces where it *is* all-null the field has no
positive control at all (use `updatedAt` there).

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786330741949-a-bounded-page-last-n-first-100-is-not-a-populatio.md`_
