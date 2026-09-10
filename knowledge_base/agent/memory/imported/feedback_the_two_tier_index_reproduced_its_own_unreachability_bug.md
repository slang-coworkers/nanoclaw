---
name: feedback_the_two_tier_index_reproduced_its_own_unreachability_bug
description: "MEASURED 08-05: index-project.md=116KB/433 rows and index-feedback.md=82KB/245 both exceed the 24.4KB read bound — the two-tier rebuild moved the truncation down a level instead of removing it."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 5476ec1c-d7c6-42a4-bf46-ebf5fa63f977
---

# The two-tier index reproduced the very unreachability bug it was built to fix

**Measured 2026-08-05**, right after adding three memories and regenerating the family indexes:

| index | bytes | rows | status |
|---|---|---|---|
| `index-project.md` | **116,019** | 433 | **OVER the 24.4KB read bound** |
| `index-feedback.md` | **81,833** | 245 | **OVER** |
| `index-technique.md` | 7,043 | 17 | ok |
| `index-command.md` | 1,621 | 3 | ok |
| `index-reference.md` | 1,132 | 4 | ok |
| `index-user.md` | 441 | 1 | ok |

`MEMORY.md` was rebuilt on 2026-08-05 precisely because a **221KB flat index against a 24.4KB read limit**
silently dropped ~90% of its rows. The rebuild split it into six family indexes. **Two of those six are
now themselves truncated on read** — 4.7× and 3.3× over. The defect was not removed; it was **moved down
one level**, and the root index's own banner now points at files that cannot be read whole.

## Why it recurred — the arithmetic was never binding

The rebuild's stated writing rule is *"keep `description:` under ~200 chars — it is the retrieval
surface."* Measured actual mean: **267 B/row (project)** and **334 B/row (feedback)** — the rule is
violated on average, not in the tail. And even at a perfect 200 B, the bound permits only **~122 rows**;
project already holds 433. ⇒ ⭐⭐⭐ **A per-row length rule cannot bound a monotonically growing row
count. Any index whose row count grows without eviction will cross a fixed read bound — the only
questions are when, and whether anything notices.**

## The rules

⭐⭐⭐ **An index needs a size check at WRITE time, not a length guideline.** The regeneration one-liner
already computes each row; it should refuse-or-split when the output crosses the bound. A rule enforced
only by intention is not enforced.

⭐⭐ **Truncation is silent and green-looking** — the file exists, links are well-formed, the index reads
confidently. Nothing in a normal read tells you rows are missing. Same failure family as the 221KB flat
index, and it went undetected here until I measured bytes for an unrelated reason.

⭐⭐ **After adding a memory, measure the index you just regenerated.** One command; it is the only step
that closes the loop:
```
cd <memory> && for f in index-*.md; do b=$(wc -c <"$f"); \
  [ "$b" -gt 25000 ] && echo "$f OVER: $b B / $(grep -c '^- ' "$f") rows"; done
```

⭐ **`type` families are the wrong partition for the two big ones.** `project` (433) is naturally
partitionable by **liveness** (open/RESUME-bearing vs. terminal) — the store already has topic indexes
doing exactly this by hand (`slang-parked-index`, `slang-shipped-index`). Splitting `project` into
live/terminal and `feedback` by domain (evidence/routing/instrument) puts every leaf under the bound
without deleting anything. **Not done in this turn — flagged, sized, and left for a deliberate pass, on
the same principle that kept the anchored-paragraph rescue from displacing more rows.**

⇒ **Do not append rescue paragraphs to the root `MEMORY.md`** for this. That is the exact mechanism
that grew the flat index while making it less reachable ([[feedback_a_remedy_that_can_reproduce_its_own_bug]]).

Related: [[feedback_empty_frontmatter_makes_a_memory_unreachable]] (the other silent-unreachability
mode), [[feedback_a_measurement_cited_later_is_a_stale_negative]].
