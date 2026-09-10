---
name: feedback_a_diff_marker_describes_a_state_not_an_action
description: "I read `<` lines from `diff master branch` as 'the branch DELETES these' and published it as verified fact — master had ADDED them (0286a2c3d5, +7/−0) hours earlier and the branch merely predates it. A two-sided diff's markers describe STATES; attributing an ACTION needs the commit (`git log -- <path>`). Worse: I handed the peer's own wrong cause back as independent confirmation."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 3d65b695-07b1-4e0f-be1f-ef59176a8b3f
---

# ⛔ I turned a state difference into an action, and called it verified

**Measured 2026-08-06, slang#12408 / `slang-diagnostics.lua`.** A peer and its reviewer disagreed about
a line number (`:5923` vs `:5930`). I "settled" it:

```
diff dl-<master>.lua dl-<branch>.lua
1749,1755d1748
< warning(
<     "deprecated-struct-cast-from-zero",
```

and published: *"the 7-line block sits at master line 1750 … the **deletion** that moved your line is
~4,180 lines above it."*

**The states were right. The cause was backwards.**

```
gh api repos/shader-slang/slang/commits/0286a2c3d5
  2026-08-06T07:42:19Z  "Add Slang language version 202c and remove (MyStruct)0 special case…"
  source/slang/slang-diagnostics.lua   +7  −0        ← master ADDED it
```

The branch **deletes nothing**. It predates an addition that landed on master after its base was taken.

⇒ ⭐⭐⭐ **A two-sided diff's `<`/`>` (or `−`/`+`) markers describe STATES, not ACTIONS.** They tell you
the files differ and in which direction the text sits; they carry **no information about which side
acted**, because "A removed it" and "B added it" produce byte-identical output. **To attribute an
action you need the commit that performed it** — `git log <range> -- <path>`, `git merge-tree`, or the
forge API, which cannot get its own diff wrong.

## ⛔ The compounding error: I supplied false CORROBORATION

The peer had already claimed *"my base deletes a 7-line deprecation warning."* I re-derived it
independently, got the same wrong cause **via the same directional misreading**, and handed it back
**with extra detail** (the ~4,180-line distance) that made it read as more thoroughly verified.

⇒ ⭐⭐⭐ **Two parties can agree because they share an error, and the agreement then suppresses the check
in both.** This is [[feedback_fusion_manufactures_the_coherence_that_suppresses_the_check]] with the
seam being *direction of authorship*. My independent confirmation was the most damaging thing I could
have contributed, because it converted the peer's hypothesis into a fact with two sources.

⭐⭐ **Severity ordering (the peer's, and it is right): the wrong CAUSE was far more dangerous than the
wrong NUMBER.** *"My branch deletes a user-visible `warning(`"* is a language-surface change requiring
maintainer sign-off. A wrong line number costs a click; a wrong causal claim about your own PR's
language surface costs a review cycle and possibly a wrong approval. **And I lent it my stamp.**

## ⛔ My store already held the rule, one generalization short

`feedback_a_plausible_story_disarms_the_implausibility_alarm` records the whole family: two-dot diff
counting others' merged work as ours, and the refinement that **three-dot is DIRECTION-SENSITIVE**
(`af81600...main` → 48 files vs `main...af81600` → 7). I did not consult it — and it would have needed
one more step anyway, because it is written about **`git diff`** and my instrument was **plain `diff`
on two downloaded files.**

⇒ ⭐⭐⭐ **The peer's sharpening is what makes the rule fire: THE TRIGGER IS THE VERB, NOT THE COMMAND.**
`A..HEAD` is correct for *"what commits are mine"* (`git log`) and wrong for *"what does my branch
change"* (`git diff`). Stated that way it covers plain `diff`, `diff <(gh api …) <(gh api …)`, and any
future two-sided comparison — which a command-keyed rule never would.

⚠️ **Both of us reached for the two-sided form first, both knew the rule, both were saved only by a
smell test** (the peer had pre-written a caption its output contradicted). ⭐⭐ **When two independent
parties who both hold a rule both violate it within the hour, the rule needs to be MECHANICAL, not
remembered** — reach for the authority that computes the answer natively rather than reconstructing it.

✅ **Authoritative forms that agreed here:** three-dot diff (returns empty ⇒ no change to that file),
`git log <range> -- <path>`, `git merge-tree` (zero conflicts), `gh api …/commits/<sha>` per-file
`+/−`. All four concur: **zero overlap, and the branch changes that file not at all.**

Related: [[feedback_a_remedy_that_can_reproduce_its_own_bug]] ·
[[feedback_deference_drifts_to_whoever_corrected_you_last]] (whose text I had to repair — I had already
copied the false cause into it) · [[feedback_an_error_toward_confirmation_evades_the_audit_that_catches_findings]]
(this failed toward confirming the peer, the class with no detector).
