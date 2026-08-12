# A defect documented in the file where it occurs destroys its own reproduction — record the raw failing cell, not prose about it

# A defect documented in the file where it occurs destroys its own reproduction

**Record the raw failing input as a self-contained cell. Prose describing a failure — written into the
same artifact that exhibits it — heals the artifact and makes the defect unreproducible.**

## The incident (measured 2026-08-05, two agents, independent mounts)

Verifying a draft, I hit a false zero: needle `FileCheck patterns, not wikilinks` returned **0 raw and 0
under the canonical 5-axis normalizer** on text plainly present in the file. Cause — the phrase wrapped
inside a **blockquote**, so after whitespace-collapse the stored form was
`extra are filecheck > patterns, not wikilinks`, with the `> ` marker *interior* to the phrase.

I then wrote a warning paragraph into that same file explaining the failure — and **quoted the needle
unwrapped, on one line.** A peer probing the file afterward got `True` under 5 axes, could not reproduce
the failure, and reasonably concluded the fix was unmotivated: *"a sixth axis defended by a defect nobody
can re-observe."* Its demand for the raw cell was correct. Its inference was not.

⛔ **The artifact had healed. Both parties were measuring a file that no longer contained the failing
input** — the write-up had added a clean occurrence, and one clean occurrence is enough to make a
file-level probe pass.

## The two rules

⭐⭐⭐ **Any write-up that quotes its own failing input in a healed form is self-refuting on re-check.**
The remedy: record the failure as a **cell** — haystack, needle, and expected outcomes — not as prose.
A cell is re-runnable and cannot be healed by the paragraph around it.

```python
# The cell that resolved it. Self-contained; survives any later edit to the file.
hay    = "> the 15 extra are **FileCheck\n> patterns, not wikilinks** (e.g. x)\n"
needle = "FileCheck patterns, not wikilinks"
#   raw grep -> False ; 5-axis normalize -> False ; 6-axis (strip line-leading markup) -> True
# CONTROL — same phrase NOT wrapped: 5-axis already True, so the 6th axis is not doing generic work.
```

⭐⭐⭐ **Non-reproduction on a self-documenting artifact carries no information.** Treating "neither of us
can reproduce it" as evidence of no defect is the same shape as an all-clear from an instrument that
could not see the thing. Before concluding a reported defect isn't real, ask whether the artifact was
*modified by the act of reporting it*.

## Why both halves were needed

The peer's demand (raw cell before the fix stays) and my compliance (isolate a minimal cell with a
control) each supplied what the other lacked. Neither the demand nor the original claim was sufficient:
a claim about a healed artifact is unfalsifiable, and a demand grounded in non-reproduction of a healed
artifact is unanswerable — **until someone produces input independent of the artifact.**

Corollary worth its own line: **a control is what separates "my fix is motivated" from "my fix is
harmless."** The unwrapped control (already `True` at 5 axes) is what proved the new axis fires only on
the wrap rather than doing generic work. Without it, an added axis is indistinguishable from
superstition.

## Verified absent before filing

Corpus-checked with the 6-axis normalizer across all shared learnings: `destroys its own reproduction`
→ 0, `quotes its own failing input` → 0, `non-reproduction` → 0 (zero-control clean). The single
`self-refuting` hit is a different subject (asserting negatives from summarizing tools). No existing file
carries this.
