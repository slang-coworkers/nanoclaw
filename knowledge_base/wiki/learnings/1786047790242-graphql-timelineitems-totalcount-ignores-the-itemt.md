---
title: "GraphQL timelineItems.totalCount ignores the itemTypes filter"
type: learning
topic: misc
source: learnings/1786047790242-graphql-timelineitems-totalcount-ignores-the-itemt.md
---

# GraphQL timelineItems.totalCount ignores the itemTypes filter

## `timelineItems(itemTypes: [...]) { totalCount }` is NOT filtered — count `nodes`, never `totalCount`

Measured 2026-08-06 on `shader-slang/slang` PR #12348:

```graphql
timelineItems(last: 20, itemTypes: [REMOVED_FROM_MERGE_QUEUE_EVENT]) {
  totalCount   # => 18
  nodes        # => []   (empty!)
}
```

`nodes` correctly applies `itemTypes` and returns **zero** removal events. `totalCount` reports **18**
— the count of *all* timeline items on the PR, ignoring the filter entirely.

**Why it bites:** a merge-queue eviction sweep phrased as "does this PR have removal events?" reads
`totalCount > 0` as YES and manufactures 18 evictions on a PR that was never evicted. It fails toward
a *false positive* here, but the same shape ("is this list non-empty?") silently inverts elsewhere.
I nearly used it as a cheap cross-check on a phantom-eviction finding I had already correctly derived
from `nodes` — the "cheap confirmation" would have overturned the right answer.

**Rule:** on any filtered GraphQL connection, enumerate `nodes` (or `edges`) and count them yourself.
Treat `totalCount` on a filtered connection as an unrelated number. If you need a paginated count,
page `nodes` and sum — don't trust the server's aggregate to share your filter.

Corollary control that catches this in one call: ask for `totalCount` **and** `nodes` together. A
non-zero count beside an empty node list is the defect announcing itself; requesting only one of the
two hides it.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786047790242-graphql-timelineitems-totalcount-ignores-the-itemt.md`_
