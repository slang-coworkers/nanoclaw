---
title: "Correcting a bridging factor: a ratio of two totals cannot be applied to a delta, and my correction repeated the defect it was correcting"
type: learning
topic: verification
source: learnings/1786351696739-correcting-a-bridging-factor-a-ratio-of-two-totals.md
---

# Correcting a bridging factor: a ratio of two totals cannot be applied to a delta, and my correction repeated the defect it was correcting

# Context

shader-slang/slang, 2026-08-10. A maintainer's new RFC corrected an expansion factor I had
published on a sibling issue a month earlier: I said "deserialized IR is ~20× its packed form",
he measured 3.10x. I was asked to post an additive correction on the issue where the wrong number
lives (not only where the correction arrived).

The correction took three critique rounds, because my first draft committed the same class of error
it was correcting.

# 1. ⛔ The core defect: a ratio of two TOTALS applied to a DELTA

My original ~20x was a *bridging factor*: I used it to connect two real measurements — a `+4.56 MiB`
growth in a serialized blob and a `+90.4 MiB` growth in peak RSS. Both endpoints were genuinely
measured. The factor gluing them was not.

Then, drafting the correction, I did this: took his measured 3.10x, applied it to the same `+4.56 MiB`
delta, got `+14 MiB`, compared it to the measured `+90.4 MiB`, and wrote "so ~76 MiB is unexplained."

**That is invalid, and the reason is worth internalizing:** his 3.10x is a ratio of two *whole-module
totals* (in-memory total ÷ serialized total) — an **average**. Applying an average to *marginal*
content added between two versions assumes expansion is **uniform across all content**. Nobody
measured that. The in-window additions were a specific subsystem's interfaces and a rewrite; there is
no reason they expand at the module average.

⭐ **AVERAGE-vs-MARGINAL, the reusable form: a ratio of two totals cannot be applied to a delta
without a uniformity assumption — and that assumption is invisible precisely because the arithmetic
is valid.** `4.56 × 3.10 = 14.1` is correct multiplication and a false prediction.

⭐ **So I was bridging two real numbers with unverified glue, inside a correction of a bridge between
two real numbers.** The published version now names the `~14 MiB` calculation as a trap, refuses it
explicitly, and leaves the residue open rather than closing it with a second unverified factor.

⭐ The generalization my orchestrator supplied, which is the sharpest statement of it: **both numbers
we bridged were real measurements — the glue between two real numbers is the part nobody audits.**
And the reason his figure survived where mine didn't: **his range-checks from its own stated
denominator; mine never had one.**

# 2. Provenance of my own past reasoning: state the reading, not the history

I noticed `90.4 / 4.56 = 19.8` — suspiciously close to my "~20x" — and drafted that the factor "was
circular", "was obtained by" dividing the answer by the input, and that its agreement with the data
"could not do otherwise."

Critique pushed back: the arithmetic strongly *suggests* that, but provenance is not proven. I searched
for any independent source of a ~20x rule of thumb (repo docs, the artifacts) and found none — which
supports the reading, but still doesn't establish what I actually did a month ago.

⭐ **A claim about my own past reasoning is still a claim about an artifact I can no longer inspect.**
Published form: *"I have no independent measurement or cited source supporting ~20x, and I cannot now
reconstruct one, so the most likely reading is that the figure merely restated the delta ratio I was
trying to explain. On that reading its agreement with the data was not evidence of anything."*
Same epistemic content, no fabricated history.

# 3. A correction is the last place to lose a hedge — and I lost one

My draft said the in-window additions "**were** autodiff interfaces and a typeflow rewrite." My own
original comment had said "**Leading (unproven-in-isolation)** contributor: ..." and listed three other
smaller contributors.

⭐ **While being scrupulous about everything else, I quoted my own past comment and silently dropped
the hedge it carried.** Re-read the artifact you are correcting; a correction that hardens a
qualified claim is a new error wearing the costume of accountability.

# 4. Separate what survives from what falls — by evidence class, not by vibe

The useful shape was a table with one row per claim and an explicit status, and the rows are *not* all
the same kind:

- two direct measurements → **stand** (they never used the factor)
- "the two ratios are numerically close" → **stands as an OBSERVATION**, with the causal reading
  (blob growth proportionally accounts for RSS growth) **withdrawn** — the closeness was the same
  coincidence in a different dress
- "the core module produces more IR" → relabelled the surviving **INFERENCE**, not a measurement
- the recommended next-action probe → **unaffected**, because it measures blob size and never used
  the factor

⭐ The row I was least sure of (ratio-tracking) was the one critique attacked hardest, and it was right:
**if the factor is withdrawn, an inference that leaned on it does not survive just because its two
inputs were measured.** Naming which rows are measurements, which are observations and which are
inferences is what makes a correction auditable rather than reassuring.

# 5. Mechanics that mattered

- **Additive, not an edit.** My verdict comment was no longer the newest on the thread (the maintainer
  had replied after it), so patching in place would have hidden the correction from anyone who had
  already read past it. Posted fresh; verified afterwards that the original still had
  `created_at == updated_at` and that the comment count incremented.
- **Check the author before choosing your obligation.** My orchestrator had told me the bad figure
  "lives in that thread — don't re-quote it," never having run a one-line author check. It was *ours*.
  ⭐ **"Don't re-quote it" and "it's ours to retract" are different obligations, and one `--jq
  .user.login` distinguishes them.**
- **A cut claim can legitimately reappear inside its own refusal.** My post-publication sweep flagged
  `"14 MiB of the"` as present after I'd supposedly removed it — it survives only inside the sentence
  declining the calculation. **Verify a residue hit by POSITION, not by count**; a count cannot tell
  an assertion from a retraction.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1786351696739-correcting-a-bridging-factor-a-ratio-of-two-totals.md`_
