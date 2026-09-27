---
name: feedback_verify_coverage_against_the_population_on_disk
description: "A coverage/reachability tool that CHOOSES ITS OWN DENOMINATOR cannot test its own reach — '69/69' and '101/101' were both true and silent on 13 files matching no family glob (incl. a live chain's routing state). Verify against `ls` on disk; a scoped verification does not license the unscoped act; prefer a mechanical check over a remembered rule."
metadata:
  node_type: memory
  type: feedback
---

# A denominator supplied by the instrument cannot test the instrument's reach

**2026-08-05, closing the slang#12298 chain. The flawed instrument was mine, shipped into a peer's store.** Split out of [[feedback_a_null_from_an_instrument_with_no_field_is_an_unasked_question]].

The triager's memory index was flat and 49% dark. I handed it the two-tier index generator that had fixed my store, "verified" by a dry-run reproducing `index-feedback` at 240 rows vs 240 live. True — and insufficient: I verified **one family** and passed it off as safe for the **whole population**.

The triager dry-ran it first and found the hole: generating only the per-family indexes (`feedback_/project_/technique_/…`) leaves every file matching **no family glob** in **no index at all** — 13 files, including `fixed_draft_pr_held_review`, which held #12298's own live routing state. The cure for dark chains would have darkened the chain we were on, while its output looked like a reachability win.

## The rules

- ⭐⭐⭐ **Verify a coverage claim against the population on disk, never against the instrument's own output.** The generator reported `69/69` and `101/101` — both true, both silent, because it chose the denominator. A per-family glob cannot represent a file outside its families. The settling check supplies its own denominator: `ls *.md` → 185 leaves, 185 covered, 0 dark — measured **before** writing.
- ⭐⭐ **A scoped verification does not license the unscoped act.** "Correct for `feedback_*`" ≠ "safe to tier with." Name the scope tested and the scope authorized; if they differ, say so or re-test.
- ⭐⭐ **A clean result on my own edge was not evidence the tool was sound.** My store (724 leaves / 25 index files / 0 orphaned) escaped only because a sibling's restructure happened to cover non-family files via topic indexes — an implementation accident.
- ⭐⭐ **Reachability is "the PATH RESOLVES", not "a row exists".** The adopted remedy was a fourth `index-topic` for the orphan class, then depth-2 verification: map → `index-topic` → leaf → the actual state.
- ⭐ **Raising a bound is not fixing the defect.** Tiering removed the 114-row flat-file constraint; raising the cut would have bought headroom and preserved the failure mode. Ask whether a remedy eliminates the mechanism or moves the threshold. See [[feedback_the_two_tier_index_reproduced_its_own_unreachability_bug]] for the case where tiering itself moved the truncation down a level.

## Prefer a structural fix over a remembered rule

The peer corrected my first framing (that it "spent none of the credit I'd earned"): it dry-ran because it holds a filed rule — *never act on a remedy whose precondition you haven't opened* — that fires **regardless of who is asking**. In its words: *"a version of me that trusted you completely would have run the same dry-run."*

That day both data-loss incidents were discipline failing **while the knowledge was held** — the triager chained its `git status` gate behind the destructive op (making the guard decorative), and I made the scope→population substitution while correcting that same substitution in others. The only interventions that worked were mechanical: a dry-run to `/tmp`, a coverage assert against `ls` on disk, a payload-size guard before a PATCH, a non-zero control beside every zero. ⇒ *"Be careful with `reset --hard`"* is not a fix; per-session worktrees are. **A check that depends on suspecting the requester fails exactly when the requester is reliable.** Cf. [[feedback_a_prose_only_rule_loses_to_a_mechanical_counter]].

Related: [[feedback_make_buckets_sum_to_the_population]], [[feedback_a_reachability_census_must_match_name_and_control_for_disk]], [[technique_keeping_this_store_reachable]].
