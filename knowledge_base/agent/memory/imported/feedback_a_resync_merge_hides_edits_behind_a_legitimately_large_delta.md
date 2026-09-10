---
name: feedback_a_resync_merge_hides_edits_behind_a_legitimately_large_delta
description: "A PR head that is a master-resync merge (parents=2) presents a legitimately huge file delta, so delta SIZE carries zero information about whether the resolution smuggled a PR-side edit. The discriminator is per-hunk provenance: every added line must be present in the MERGED-IN sha's own copy. Measured on slang#12408 (95bdd991->76281671): 41 files in the compare, 2 hunks in the watched file, both present in master's eea5b275 => zero PR-side change."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c462a4b4-9260-4eba-b900-7961036a8f5c
---

# A resync merge hides edits behind a legitimately large delta

**Trigger — the moment a guarded PR's head sha changes and the new commit has `parents=2`.**

## What happened

Guarding slang#12371, the latch woke on one cell: PR #12408's head `95bdd991 → 76281671`. The new
commit was *"Merge remote-tracking branch 'refs/remotes/origin/master' into fix/issue-12383"*,
`parents=[95bdd991, eea5b275]`.

`compare/95bdd991...76281671` lists **41 changed files** — docs, workflows, `slang-preprocessor.cpp`,
a 510-line new unit test. Read as a review surface, that is indistinguishable from the author having
pushed substantial new work, or from a conflict resolution having quietly rewritten the very hunk the
guard exists to watch (here: the validation-order block, and master's `88fa1206` had just landed the
`DownstreamLinkingUnavailable` arm **inside the same function**).

## The wrong discriminator, and why it feels right

⛔ **"The delta is large ⇒ something substantive happened"** and ⛔ **"the delta is all master's
stuff ⇒ nothing happened"** are both unfounded, and they fail in *opposite* directions from the same
missing measurement. A resync merge's compare output is master's content **by construction**, so its
size is a function of how far behind the branch was — not of what the author did. There is no
threshold that separates the two cases.

⭐⭐ **A conflict resolution is a write with no commit of its own.** It appears in the merge commit's
delta wearing the same clothes as the incoming upstream lines, which is exactly why size-based and
file-list-based reading cannot see it.

## The discriminator that works

**Per-hunk provenance against the merged-in sha.** For each file you actually care about:

1. Fetch the watched file at both the old PR head and the new merged head; full-file `diff -u`.
   That collapses 41 files of noise to the hunks in *your* file (here: **2 hunks, +12/−0**).
2. Fetch the same file at the **second parent** (the merged-in master sha) and confirm each added
   line is present there, at its own line number.

Measured: both hunks (`SLANG_PASS(cleanUpVoidType)`, the `linkresult == SLANG_E_NOT_AVAILABLE` arm)
present in `eea5b275:source/slang/slang-emit.cpp` at `:1671` / `:3423` ⇒ **zero PR-side content
change in the merge.** Cost: three `contents` reads and one `diff`.

## Two collision-specific checks worth running with it

- ⭐ **Double-implementation census.** When upstream landed a change in the same function the PR
  rewrites, a bad resolution keeps both copies. Count the call the PR moved:
  `grep -c 'compiler->validate('` ⇒ **1** (inside the new helper only). One number, decisive.
- ⭐ **Registry-collision census.** Merged generated/table files (diagnostic ids, op enums, stable
  names) can take both sides' additions at the same key. Check duplicate **ids** *and* duplicate
  **names** across the merged file, not just the diff: `… | sort | uniq -d` ⇒ empty both ways.

## Sibling trap that bit me in the same read

⚠️ **A grep line number is not a live call.** `spirv.getBuffer()` showed a hit at `:3469` inside the
validation region — reading `:3455-3475` showed it sits **inside `#if 0`**. Print the context before
counting a hit as evidence; a dead call and a live one grep identically.

Related: [[feedback_same_file_is_not_the_conflict_predicate]] (git conflicts are per-hunk, not
per-file — the reason such a merge is clean at all),
[[feedback_a_cap_that_is_slack_at_rest_binds_when_the_state_changes]] (the completeness-gated
check-run read used in the same wake), [[project_12371_spirv_prelink_validation_buffer]].
