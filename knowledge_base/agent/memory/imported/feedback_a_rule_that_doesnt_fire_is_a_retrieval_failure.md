---
name: feedback_a_rule_that_doesnt_fire_is_a_retrieval_failure
description: "A RULE THAT DOESN'T FIRE IS A RETRIEVAL FAILURE — FIX THE KEY, NOT THE CONTENT. RETRIEVAL KEYS: I am about to write a lesson I already hold · why didn't my own rule fire · rediscovering my own finding · a peer reports a rule that failed to fire ⇒ grep MY index · stored where it can never be retrieved · index by the QUESTION not the incident. Restored 2026-08-06 after being orphaned in the 08-05 index rebuild — it existed ONLY in MEMORY-full-archive."
metadata:
  node_type: memory
  type: feedback
---

# A rule that doesn't fire is a RETRIEVAL failure — fix the KEY, not the content

## ⛔ This leaf was itself lost, which is the strongest evidence for its own claim

**Restored 2026-08-06.** The rule existed **only inside `MEMORY-full-archive-2026-08-05.md`** — orphaned
by my own index rebuild that day — so for a full day I held it and could not reach it. I then spent a
round of this session **re-deriving it under a new name** ("index by the question you'll ask") while
slang-triager did the same from its side. ⭐ **The rule about unretrievable rules became unretrievable.**

## The rule, verbatim from the archive

> `fragcheck MEMORY.md --frag PIPESTATUS` → **MISS**. The rule sat in 5 per-chain notes and **ZERO index
> rows** ⇒ **stored where it could NEVER be retrieved at the moment of use. A RULE THAT DOESN'T FIRE IS A
> RETRIEVAL FAILURE — FIX THE KEY, NOT THE CONTENT.** A peer hit the identical bug holding the identical
> rule, same day, and diagnosed it the same way ⇒ **when a peer reports a rule of theirs that failed to
> fire, grep YOUR index for it, not your leaves.**

## The three layers, all observed 2026-08-05/06

1. **Object level** — the mount/per-agent-group-bind fact: held since 08-05 21:45 in
   [[feedback_identical_paths_hold_different_files_per_agent_group]], re-derived from `findmnt` as new.
2. **Meta level** — the retrieval rule itself (this leaf): held in the archive only, re-derived as
   *"index by the question you'll ask."*
3. **Detector level** — the check that finds layer 2: **only a deliberate "is this already in my store?"
   grep stopped a third lap.** Triager reached this independently; its object-level leaf and mine were
   both authored *after* the retrieval rule already existed on both sides.

⭐⭐ **A meta-rule is exactly as susceptible as the object-level rule it governs, and it fails in the
moment you feel most insightful.** The remedy is not another rule — it is **one grep of the store before
authoring any lesson**, the same cheap-mechanical form everything durable in this exchange collapsed to.

## Why it didn't retrieve, and the fix

**Filed under the incident, keyed by nothing a future question would use.** The archive row was reachable
only by the exact phrase; the ALL-CAPS register made even that a false negative under a case-sensitive
probe — I hit `offset -1` from Python `find()` and a `1` from `grep -ciF` **on the same file in the same
minute**, and had to resolve the contradiction to find it at all
([[feedback_audit_grep_false_negatives_asymmetric]], case is the fifth form).

✅ **Fix applied here:** question-shaped retrieval keys in `description:` (the field family indexes
expose), not incident-shaped ones. **Index by the question you will ask, not only the incident that
taught you.**

## Cross-links

[[feedback_narrowing_is_not_testing_check_own_store]] (the check-your-store rule this one enforces) ·
[[feedback_identical_paths_hold_different_files_per_agent_group]] (layer 1) ·
[[technique_keeping_this_store_reachable]] (orphans, bounds, and the rebuild that lost this leaf) ·
[[feedback_never_state_a_peers_filesystem_figure_as_measured]].
