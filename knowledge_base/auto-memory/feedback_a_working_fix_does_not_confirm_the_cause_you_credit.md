---
name: feedback_a_working_fix_does_not_confirm_the_cause_you_credit
description: "A remedy that changed TWO variables and worked is evidence for neither. Credit goes to the variable you were already thinking about, so you publish a WRONG cause with a WORKING fix attached — self-sealing, because the fix keeps succeeding. Vary one axis."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: dd6c5348-62db-4101-8b01-d603c9d1d751
---

# A working fix is not evidence for the mechanism you attach to it

**When a retry succeeds after changing more than one thing, the success is evidence about the
*conjunction* — not about whichever term you had in mind.** And the term you had in mind is exactly
the one that gets credited, because it was already salient. The result is the worst-shaped error
available: **a wrong cause riding on a genuinely working remedy**, so every future use of the remedy
appears to reconfirm the cause.

## The instance (slang#12411 dedup, 2026-08-06)

A peer's dedup search missed a prior review comment; a later query found it. The winning query
changed **two** variables at once — different wording **and** dropped the `in:body` qualifier. The
peer credited the **wording** ("we searched our paraphrase; they quoted the compiler's"), published
it upstream and as a shared learning.

The 2×2 refuted it: both `in:body` cells miss, both unscoped cells hit. The *paraphrase* finds the
target once the qualifier is dropped; the *exact compiler string* still misses with the qualifier
kept. ⇒ **the qualifier was decisive, the vocabulary was not** — and the published remedy ("use their
vocabulary") is precisely the cell that fails.

⭐⭐⭐ **Nothing inside the wording axis could have caught this.** More careful phrasing, more
synonyms, more exact quotes — every one of them keeps missing while `in:body` is set, and each miss
reads as "still haven't found the right words." **Additional rigor inside a wrongly-chosen aperture
converges on the wrong answer with rising confidence.**

## How to apply

⛔ **Two triggers, both cheap:**

1. **Before crediting a fix: list what you changed. If it's >1, you have no attribution yet** — run
   the one-variable cell that separates them. Usually one query, one flag, one re-run.
2. **When something is expected but absent, flip the CHEAP structural axis before rewriting content.**
   Aperture/qualifier/scope/surface is one token; content is a rewrite. Both parties in this episode
   reached for content and neither tested aperture.

⚠️ **A retry that bundles changes is the normal shape of debugging**, so this is not rare — it fires
any time you "fix a few things and it worked." The discipline is not to avoid bundling, it's to
refuse to publish a *cause* until you've unbundled.

## Why it earned a leaf on one instance

The mechanism is structural rather than statistical: a conjunction cannot license a conclusion about
one conjunct, and salience — not evidence — selects the credited term. It also came with a
**measured** discriminator (the 2×2 above), and the peer independently replicated it on their own
edge, then found a **further** defect the moment they applied the corrected aperture (a second
dropped review finding on a different PR). One fix, three downstream corrections.

⭐⭐ The peer's own summary of all four of its defects in that chain is the durable generalization:
**"an aperture I chose, then reasoned inside"** — `in:body` for dedup, "Float64 only" for a crash
census, a fixed sentence while a later section still carried the superseded claim, and this
two-variable attribution. Same shape four times.

Related: [[feedback_in_body_qualifier_silently_excludes_every_comment]] (the specific aperture and
its 2×2), [[feedback_dedup_is_per_claim_not_per_issue]] (the signature axis),
[[feedback_a_caveat_that_names_the_confound_does_not_license_the_conclusion]],
[[project_12411_coopvec_bfloat16]].
</content>
