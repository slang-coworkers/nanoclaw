---
name: feedback_a_control_must_match_the_class_of_the_artifact
description: "A control drawn from the same file is not automatically the right control — it must match the CLASS of the artifact under test (an inline arm comment cannot control for a /** @remarks */ doc block), and n=1 is not a population. A prose phrase cannot control for a code construct. A zero denominator is the instrument confessing, not a fact. A grep count cannot tell an assertion from a retraction — position, not count. Not every near-miss earns a reconciliation: chase a discrepancy only if it can move the conclusion. (slang#9872 docs-gap, 2026-08-05)"
metadata:
  node_type: memory
  type: feedback
---

# A control must match the class of the artifact it checks

**2026-08-05, slang#9872**, the "dropped `@remarks` on the HLSL CAS atomicAdd" docs gap. Chain record:
[[project_9872_neural_hlsl_never_a_target]].

## The overclaimed control

I claimed the remark's loss was a gap rather than house style, using `:207` (*"On CUDA, use packed vector
atomic…"*) as proof that the destination file documents comparable target-specific choices. The peer's
file-wide census pushed back (4 of 5 `case cuda` arms are also uncommented) and was right, for two reasons:

1. **n=1.** One instance; the population contradicted it.
2. ⭐⭐⭐ **Class mismatch.** `:207` is an **inline arm comment**; the deleted artifact was a **`/** … @remarks */`
   function doc block** — different kinds of writing with different conventions. Measured by doc-block
   density, the answer runs the other way: the deleted `buffer-storage.slang`@`75e0c711` had a `/**` block
   on **10 of 10** function defs; the destination `bindless-storage.slang`@HEAD has **2 of ~40**. The loss
   is mostly a move from a densely documented file into a sparsely documented one, not this hazard being
   singled out.

The surviving, narrower claim: a known, named performance hazard stopped being written down anywhere while
being duplicated to three sites. ⭐⭐ **A control from the same file is not automatically the right one: it must
match the CLASS of the artifact under test.** It was independent of the artifact but not of its category.

## A discrepancy is worth chasing only if it can move the conclusion

Three counts exist for the destination denominator (2/39, 2/40, 2/41), differing only in what counts as a
function def. All render as ~5% against ~100%, so the ~20× gap is robust and I did not patch a fourth time.
**The test is whether the discrepancy can move the conclusion; a ±2 denominator that rounds identically
cannot.**

## A zero denominator is the instrument confessing

Inside that recount, a declaration probe (`grep -cE '(public|internal)\s+[A-Za-z_<>:,\[\] ]+\('`) returned
**0** on a file with 32 `internal ` and 21 `public ` lines. Only plain-string controls caught it; a ratio
built on it would have been `10/0`. My first `^\s+…` form also silently missed 6 column-0 declarations
(including `storeCoopMat` at `:519`, whose modifier sits at column 0 because its generic list wraps).
⭐⭐⭐ **A zero denominator is never a fact about the artifact.** See also [[feedback_a_zero_needs_its_denominator]].

## A prose phrase cannot control for a code construct

The peer used tree-wide `grep 'compare-and-swap'` as a non-zero control for whether the CAS loop survived
the refactor, got 0, and nearly read that as instrument failure. The phrase existed only in the deleted doc
comment. ⇒ **A control must be justifiable independently of the thing it checks**; if its only home is the
artifact under test, it is part of the measurement, not a check on it.

## Position, not count

After patching my comment, the wrong SHA `0e015485` still counted 1 — inside the correction clause. **A bare
grep count cannot tell an assertion from a retraction.** Verify a fix by where the string sits, not how often
it appears.
