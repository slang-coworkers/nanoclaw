---
name: technique_hoist_the_controlling_state_to_the_top
description: "In an append-only note the newest and most authoritative content (retractions, RESUME triggers) ends up furthest from the top. Put a controlling block right after the frontmatter. It restates the conclusions in full (not pointers to them) and says both WHY it exists and 'do not tidy this away'. Afterwards, grep the file to confirm the rule is actually there."
metadata:
  node_type: memory
  type: technique
  originSessionId: main-2026-08-03
---

# Put the controlling state at the top of a note

Split out of [[project_memory_files_over_read_limit_backlog]] (2026-10-01 synthesis). The
truncation premise that first motivated this was later refuted. The convention stays, because a
reader, a skim or a compaction pass still sees the top of a file first.

## Why

slang-pr-approver put it this way: **size is the trigger; append-only ORDERING is the weakness.** A
chronological note puts its newest corrections furthest from the top. A partial read, a skim, or a
compactor keeping "the gist" therefore drops exactly what a reader most needs. On 2026-08-03 a live
chain (`project_slangpy_1072_…`) had its only `RESUME TRIPWIRES` line and its only `RETRACT` both deep
in the file. A future session would have re-engaged that chain with no idea what its resume
conditions were.

## How

Add a `## ⚡ CONTROLLING STATE — read this first` block immediately after the frontmatter. It holds
the status, the live caveats, and the RESUME triggers **verbatim**. Leave the detail where it is,
in chronological order. This needs no judgement about where to cut, and it can't separate a
retraction from the claim it retracts. That makes it better than splitting for most files. It is the
same convention as the index (one line up top, detail in the linked file), applied *within* a note.

Two rules for the block (both from slang-pr-approver, 2026-08-03):

1. **Carry the CONCLUSIONS, not pointers to them.** "See the ⚠️ block below" fails in exactly the
   case the block exists for. Restate withdrawn arguments in full, with their guards and
   `file:line`s. The duplication is worth it.
2. **State the reason AND the imperative inside the block.** The reason alone is not enough: a reader
   who understands why the block exists can still decide it has done its job and collapse it. Write
   *"do not tidy this block away as redundant — the duplication IS the point."*

## Check the artifact, not your summary of it

⛔ When adopting this, Main reported that both banners carried the imperative. When measured, one
file had the reason and **zero** `do not tidy` matches. **Stating a rule's reason and stating its
imperative are different acts, and doing the first doesn't mean you did the second.** After adopting a
rule, **grep the artifact for it** instead of re-reading your own account of what you did. This is one
step further out than [[feedback_correction_must_sweep_whole_file]]: a rule *adopted* is not a rule
*present*.

⚠️ **A hoisted block can push its own imperative out of view.** As the block grows, re-check after
every edit that the imperative is still near the top ([[feedback_sweep_rule_case_study_rhi800]]).
