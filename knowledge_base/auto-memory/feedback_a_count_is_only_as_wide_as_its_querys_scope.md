---
name: feedback_a_count_is_only_as_wide_as_its_querys_scope
description: "I briefed '8 open items' for a departing engineer from ONE repo-scoped search; the real figure was 39 across two repos (~5x). A scoped query cannot see outside its scope BY CONSTRUCTION, so its zero-for-the-rest is structural, not evidential. State the scope with the number."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 59a5d801-d899-4929-873e-3b62abc8646f
---

# A count is only as wide as its query's scope — say the scope with the number

**Measured 2026-08-05/06, slangpy#1001 scrub.** Asked to assess a departing engineer's orphaned
work, I ran one query:

```
gh api "search/issues?q=repo:shader-slang/slangpy+author:mkeshavaNV+state:open"   # → 8
```

and briefed **"mkeshavaNV has 8 open slangpy items"**, then repeated it in a peer dispatch as the
reassignment scope. The `slangpy-triager`'s census — sha256 over every comment in the requester's
fan-out — returned the real figure: **34 sweep comments = 12 slangpy + 22 slang**, and **39 open
items** touching him across both repos (27 still assigned, 5 genuinely unowned). I was low by ~5×.

## Why this is structural, not sloppiness

⛔**The query was correct and its answer was true.** `repo:shader-slang/slangpy` **cannot** return
slang issues — not "missed them", *could not see them*. So the 22 absent items produced **no
signal**: no error, no empty field, no warning. The output looked like an inventory because it was
shaped like one.

⭐⭐⭐ **A scope restriction converts everything outside it into a silent zero.** This is the
false-coverage family ([[feedback_false_coverage_the_five_mechanisms_that_consume_the_reason_to_look]]):
a state that cannot say *"I didn't look there."* And the trigger word was in the request itself —
the sweep spanned two repos; I scoped to one because that was the issue in front of me.

⚠️ **The compounding error: I reported it as the inventory, not as "slangpy only."** Had I written
*"8 open slangpy items (slangpy-scoped query; slang not checked)"*, the gap would have been visible
to the peer at a glance and cost nothing. Instead a **downstream tier had to discover it**, and
"8 open items" was already in a dispatch aimed at a maintainer-facing comment.

## Why the census beat the search

The right instrument matched the *event*, not the artifact: the requester's sweep was N
byte-identical comments, so **enumerate the comments and hash them**. That found what no
author-scoped search could — including **slang#6664**, assigned to him and *missing* from the sweep
(a gap that only exists relative to the census's union). ⭐⭐**When the thing you are counting was
produced by one event, enumerate the event's outputs, not the entities you assume it touched.**

## How to apply

- ⛔**Never publish a count without its scope in the same sentence.** "39 across slangpy+slang" or
  "8 in slangpy only" — never a bare "8 open items."
- ⭐**Before reporting an inventory, ask what the query could not have returned.** Repo scope, `state:`
  filter, `author:` vs `assignee:` (an author-scoped query misses items assigned-but-not-authored —
  exactly the #820/#821 case), date windows, `per_page` truncation.
- ✅**For "everything touching X", use ≥2 orthogonal queries and reconcile.** `author:` ∪ `assignee:`
  ∪ `commenter:`, per repo. Disagreement localizes the gap; agreement is weak evidence but better
  than one query.
- ⚠️**A single-query inventory is a lower bound.** Label it that way, and it stays useful while
  becoming honest.
- ✅**Hash reconciliation beat hash comparison:** two sessions got prefixes `f5f9b897` vs `f64d587a`
  for the "same" bodies — reconciled exactly as 184-byte body vs 185 bytes with jq's trailing
  newline. ⇒ **Publish the conclusion ("all byte-identical"), not a hash prefix that doesn't
  reproduce across extraction methods.**

Related: [[feedback_search_code_total_count_is_not_a_file_count]] (adjacent: the number returned is
not the number you want), [[feedback_a_positive_control_cannot_detect_an_incomplete_enumeration]]
(the control fires and the enumeration is still short),
[[feedback_a_batch_census_needs_the_owner_column_not_the_reply_column]],
[[project_slangpy_1001_build_time_kernel_compilation_scrub]] (the chain).
