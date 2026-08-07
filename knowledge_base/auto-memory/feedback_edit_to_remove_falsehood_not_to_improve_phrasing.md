---
name: feedback_edit_to_remove_falsehood_not_to_improve_phrasing
description: "The threshold for patching an already-published comment: edit to remove falsehood, never to improve phrasing. Test = does the current text make any statement FALSE, or only less well-put? Churn on an accurate artifact loses to the gap."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: b4a34152-7bc9-40b5-be8d-99f7189edbb2
---

# Edit to remove falsehood, not to improve phrasing

**Settled 2026-08-06** on shader-slang/slang#8183 by slang-triager, after **four** in-place patches to
one comment (`issuecomment-5011412057`, 1724 → 3825 → 4516 → 5277 chars) that a maintainer
(`zangold-nv`) was about to read for the first time.

Two candidate fifth patches existed. **Both declined, for the same reason at different strengths:**

| candidate | test applied | outcome |
|---|---|---|
| my stale *"zero submitted reviews and zero review comments"* | a new **issue-level PR comment** is neither a review nor a review comment ⇒ the sentence is still **true** | decline |
| the producer-vs-consumer *framing* sentence | grepped the comment: `lowerOutParameters` = 1, `constructing no layout at all` = 1, `does **not** touch` = 1 ⇒ **the raw facts are present; only the framing sentence is absent, and its absence makes nothing false** | decline |

⭐⭐⭐ **The threshold: patch 4 was MANDATORY — three published claims had gone false. A fifth would be
discretionary polish, and churn on an accurate artifact loses to the gap.** The test is not *"is there a
better version of this?"* (always yes) but **"does the current text make any statement FALSE, or merely
less well-put?"**

⭐⭐ **The check for the second candidate is the reusable move: grep your own published text for the
facts before deciding it's missing them.** "The framing isn't there" felt like an omission; counting the
constituent facts showed they were all present and only the *summarizing sentence* was absent — which is
a readability delta, not a correctness one. **A missing frame around present facts is not a defect.**

⚠️ **Why the bar rises with each revision, not falls:** every patch adds an `*(edited)*` marker and more
text to a comment whose reader is arriving cold. At four revisions the marginal clarity of a fifth is
swamped by the cost of a longer, more-amended artifact. ⇒ **Edit count is itself a cost the next edit
must beat.**

Pairs with the *conditional* rule for choosing edit-vs-append at all
([[feedback_edit_in_place_vs_append_is_conditional_not_a_convention]],
[[feedback_patch_vs_fresh_comment_edit_hides_a_correction]]) — those decide the *mechanism*, this decides
whether to act **at all**. And note the counter-case that outranks this rule:
[[feedback_an_enumeration_claim_needs_a_computed_complement]] amended a comment whose *conclusion* was
unaffected, because the wrong detail was **a pointer to action**. ⇒ **"only phrasing" and "conclusion
unaffected" are different tests: ask what a reader would DO with the current text.**

✅ **Verification that a decline is honest, not lazy:** the triager also grepped the verdict for readings
it did *not* want to leave standing — `wrong to` / `should not have` / `not an objection` = **0 each** —
i.e. it confirmed the absence of a *harmful* implication before declining to add a clarifying one. **A
decline needs the same evidence as an edit; it is a claim about the current text, not a non-action.**

Chain: [[project_8183_wgsl_metal_displacement_segfault]].
