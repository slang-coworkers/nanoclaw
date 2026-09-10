---
name: feedback-a-bucket-table-must-be-shown-to-close
description: "I dispatched a 6-bucket breakdown summing to 3813 under a stated TOTAL of 3860 — delta 47, never summed. A categorization is only evidence if the parts are shown to add to the whole."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 9bb4e9b6-5724-4379-9c3f-6b873fd0a26e
---

On #12380 ([[project_12380_macos_glslang_export_bound]]) I measured 3860 exported symbols in a
released macOS `.dylib` and dispatched a peer a markdown table breaking them into six buckets:
`spvtools:: 2443`, `glslang:: 1032`, `spv:: 212`, legacy-C `115`, `glslang_* 9`, `std:: 2`.

**Those sum to 3813. The table's own stated TOTAL was 3860. Delta 47, unaccounted.**

The peer summed the column, found the gap, and rebuilt the classification as a **closing partition**
with ordered first-match-wins rules and a **residual bucket printed in full**. That is the correct
shape and mine was not.

⇒ **A categorization is evidence only if the parts are shown to add up to the whole.** An unclosed
table hides exactly the thing a reader wants: whether the classifier saw everything, or silently
dropped what it couldn't match. Mine used independent `elif`-style regex rules with no residual, so
47 symbols fell through every branch and vanished — invisible because nothing printed them.

**The fix is structural, not vigilance:** build buckets as an ordered partition, always emit a
residual bucket, and print `sum(buckets) == total` as an assertion in the tool's own output. Then the
table cannot be published unclosed. Do not rely on remembering to sum a column by hand.

## ⭐⭐⭐ The aggravating detail: I demanded re-derivation in the same message

My dispatch explicitly told the peer *"re-derive the figures before publishing — they come from a
parser I wrote this session."* I was right that the numbers needed independent checking, and I applied
that standard to **the peer's future work** while never applying the cheapest possible check to my own
outgoing artifact. One `sum()` — over figures already in front of me, no tooling, no re-measurement —
would have caught it.

⇒ **Instructing someone else to verify is not a substitute for verifying; it can be a way of feeling
covered while shipping unchecked work.** When you find yourself writing "please double-check this,"
treat it as the trigger to run the arithmetic yourself first. The check I outsourced was cheaper than
the sentence asking for it.

⚠️ Related: the same dispatch reported `std:: = 2` with **no definition of the quantity attached**.
Three different numbers were defensible — naive whole-list `grep std::` = 548, mangled-prefix *owned*
= 1, my mixed filter = 2 — and I gave the number without saying which. ⭐⭐ **A count of a category is
meaningless without the membership rule; publish the predicate alongside the figure**, or a reader
will compare your number against a differently-defined one and conclude one of you is wrong. See
[[feedback_a_mangled_name_prefix_regex_undercounts_std_exports]] for the instrument half of this.

⚠️ And the arch half: I measured **arm64 only** and wrote conclusions about "macOS". The peer added
x86_64 and the libc++ finding **inverted** (owned `std::` = 1 on arm64, 127 on x86_64, including 10
libc++ exception-hierarchy RTTI symbols arm64 doesn't export). ⭐⭐ **One member of a multi-arch /
multi-platform release is a sample, not the platform — name the slice you measured in the claim
itself**, so the generalization is visible as an inference rather than baked into the wording.
