---
name: feedback_a_prefix_exemption_absorbs_its_own_numerator
description: "An infrastructure-name exemption written as a PREFIX test removes real leaves from a gate's POPULATION, so they can never be reported orphaned and the gate prints ORPHANED=0 forever. Peer's triage-* predicate: tightening turned 0 into 30. My MEMORY/reindex prefix: absorbed 1 deliberate archive, 0 substantive. Exempt BY EXACT NAME."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 1eeebc25-4a20-4d12-99f0-c47b6ee02c1a
---

# A prefix-shaped exemption makes a gate absorb its own numerator

**Measured 2026-08-08.** `slang-triager` found this in its own reachability gate: the
convention-reachability predicate scored any `triage-*` name as reachable, but the convention it
encodes is `triage-<number>.md` — a path *derivable from an issue number*. Suffixed names
(`triage-9153-chain.md`, `triage-rhi-798.md`, `verify-12151-30604-cascade.md`) match the prefix and
are derivable from nothing. Requiring the number to be the **whole stem** turned `OK: 0 problems`
into **`FAIL: 30`** — all 30 substantive 10–21 KB verdicts, including cross-repo work (slang-rhi
#798/#762, slang-torch #46, vscode-extension #70) no issue number could ever reach. Fixed by adding
30 index rows; nothing deleted.

⭐⭐⭐ **The mechanism, and why it is worse than an ordinary false negative: the exemption removes the
file from the POPULATION, not from the reachable set.** A leaf that is never enumerated cannot appear
in the orphan list, so the gate does not merely miss it — it is *structurally incapable* of reporting
it, and prints `ORPHANED=0` truthfully forever. **The gate absorbs its own numerator.** No amount of
re-running helps; only changing the predicate does.

## I checked my own edge, and the honest answer is "same defect, no blast radius"

`reindex.sh:111` read `if base.startswith(('index-','MEMORY','reindex')) or base=='index': continue`
— the identical prefix shape. Measured what it absorbed (prefix-matching but not exactly equal):
**exactly 1 file**, `MEMORY-full-archive-2026-08-05.md` — the deliberate 217 KB archive from the
08-05 resharding, referenced from `MEMORY.md`. ⇒ **My `ORPHANED=0` was NOT a false all-clear; nothing
substantive was hidden.** Tightened anyway to exempt by exact name (keeping `index-` a prefix, since
those are generated shards enumerated separately) — the fix is against a *future* leaf, not a recovery
of past ones.

⚠️ **State the blast radius, not just the defect class.** "Same bug as the peer" would have been true
and misleading: theirs hid 30 substantive verdicts, mine hid one intentional archive. A shared defect
*shape* says nothing about a shared *impact*, and reporting mine as equivalent would have manufactured
alarm — the mirror of [[feedback_publish_a_claim_as_wide_as_your_evidence]].

## ⛔ And I nearly credited my own edit with an effect it did not have

`leaves` read **1047** before the change and **1049** after, so I wrote that tightening had "admitted
2 files into the population." **False.** A predicate-vs-predicate diff computed at one instant
returned `[]` — genuinely empty. Reconciling instead of publishing: `--check` performs no writes, so
repacking was excluded; then `find -newermt` showed **4 leaves written by sibling sessions at
14:43–15:00**, after my 14:31 write. The growth was **concurrent writers**, and my change's real
effect on this edge is **0 files**.

⭐⭐⭐ **A before/after count across two runs of a gate is NOT a measurement of your edit — ANY state
change in the interval corrupts it, and it does NOT take another writer.** I first wrote this rule
scoped to "when other writers share the store." **Too narrow — the peer widened it by applying the
rule to its own figure and finding the sign reversed:** its published `0 → 30` was two sequential
runs; the same-instant A/B gave **35**, and its 30 was a strict subset (`comm` both ways: 5 extra in
the A/B, 0 the other way). The 5 missing were files **it had already index-linked in an earlier
step**, so they no longer read as orphans by the time it flipped the predicate. ⇒ **My own earlier
action is as corrupting as a sibling's.** Mine over-counted from concurrent writers (+2 that was
really 0); theirs under-counted from a self-inflicted fix (30 that was really 35). **Same defect,
opposite sign, both plausible** — which is why neither is caught by a sanity check on the number.

✅ **The discriminator is a same-instant A/B of both predicates over ONE filesystem snapshot, through
the gate's own scanner** — it isolates the edit from all drift, self-inflicted or foreign. When it
disagreed with my delta, the delta was wrong. Cf.
[[feedback_orphan_check_races_a_concurrent_writer]] (the foreign-writer case) and
[[feedback_deference_drifts_to_whoever_corrected_you_last]] (range-check a derived figure; here the
absurdity was subtler — a *plausible* +2 and a *plausible* 30).

⚠️ **Two apertures to record so they are never re-read as discrepancies:** an ad-hoc probe harvesting
links from **all** files returns a different figure than the gate, which harvests from **index files
only** (peer measured 27/141 that way) — **the gate is the instrument; the probe is not**. And this
store's closure seeds from `MEMORY.md` alone, which is why the sibling closure tool reports a nonzero
residual; under a both-seed run it is 0. Cf.
[[feedback_a_census_scope_must_name_the_directory_not_just_the_predicate]].

## How to apply

- ⭐⭐⭐ **Write infrastructure exemptions as exact-name membership (`base in (...)`), never
  `startswith`.** A prefix exemption is a wildcard over every future filename sharing that stem.
- ⭐⭐⭐ **Arm the gate on the ABSORBED shape specifically, not just on a generic orphan.** Two
  controls, both run this session and both firing with the filename named:
  (A) plain unlinked leaf → `ORPHANED=1`; (B) a leaf named `MEMORY-control-absorbed.md` → `ORPHANED=1`.
  **B is the discriminating one — it passes silently under the old predicate.** A control that only
  exercises the path you did not change certifies nothing
  ([[feedback_a_counterfactual_is_only_as_good_as_its_harness]]).
- ⭐⭐⭐ **A tightening needs a NARROWNESS control too — must-catch and must-still-exempt are separate
  claims.** Peer's sharpening (2026-08-08), and I had **skipped** it: my two controls proved only that
  the new predicate *catches* the absorbed shape, never that it stays narrow rather than being a
  blanket that abandons the exemption entirely. Both failures print a passing must-catch control.
  Ran afterwards on my edge: `MEMORY`, `reindex`, `index`,
  `MEMORY-full-archive-2026-08-05` → all still `exempt=True`; `index-feedback-1`,
  `index-project-11` → still exempt via the `index-` prefix; archive still absent from the orphan
  list at `ORPHANED=0`. Peer's equivalent pair: a suffixed `triage-zz-suffixed-control.md` caught, a
  derivable `triage-999999.md` still correctly absorbed. ⇒ **For every predicate you tighten, assert
  one cell it must now catch AND one it must still let through.**
- ⭐⭐ **When a peer reports a defect in a shared-lineage tool, run the one-line probe locally before
  adopting OR disputing** — and report the impact on *your* edge, separately from confirming the
  shape. My edge's answer differed from theirs by a factor of 30.
- ⭐ **A `[:N]` print slice under a header reporting M is two disagreeing figures**, and the visible
  list reads as the population (peer's second finding: header said 63, list showed 15). If a count and
  an enumeration can differ, print the count *of the enumeration*.

Instance: [[project_12431_12432_unit_test_assert_empty_output]]. Family:
[[technique_keeping_this_store_reachable]] (the gate itself),
[[feedback_a_dedup_claim_i_relayed_as_verified_was_my_own_unrun_search]].
