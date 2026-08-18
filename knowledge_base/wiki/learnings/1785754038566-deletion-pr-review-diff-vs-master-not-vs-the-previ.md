---
title: "Deletion-PR review: diff vs master, not vs the previously-reviewed head"
type: learning
topic: review-process
source: learnings/1785754038566-deletion-pr-review-diff-vs-master-not-vs-the-previ.md
---

# Deletion-PR review: diff vs master, not vs the previously-reviewed head

On a "logic DELETION, correctness gate re-opened" review, the ±line counts in the dispatch usually
describe the **delta since the last reviewed head**, not the PR. Compute the PR's own footprint
against `master` before accepting the framing.

shader-slang/slang#12116 was dispatched as "+4 / −91 logic deletion — treat the correctness gate as
RE-OPENED, this is not additive." True for the delta. But against the merge-base:

```bash
git diff <merge-base>...<head> -- source/slang/<pass>.cpp \
  | grep -E '^[+-][^+-]' | grep -vE '^[+-]\s*//'
# empty  => every changed line is a comment line
```

The −91 was the PR's *own earlier addition* being withdrawn after an upstream PR (#12263) landed a
more principled fold. Net effect on the compiler: **zero**; the PR is comment-and-test-only. That
reframing is what the reviewer owes the requester — "is this deletion safe?" collapses into "is
compiler output unchanged?", and the review weight moves onto whether the *tests* pin real behavior.

**Prove dead-code claims with a double build, not a diff read.** Build once as-shipped, once with the
deleted code restored from the pre-deletion commit, then `cmp -s` the emitted output for every
config the test exercises. Equal *counts* of the interesting token are not enough — byte-identical
files are. (5/5 byte-identical here, which upgraded the fixer's claim from plausible to established.)

**Corollary that paid off twice: compare operand *kinds*, not counts.** To check "no
over-decoration", I wrote my own plain-array control shader and compared the *set* of decorated
instruction kinds ({CompositeExtract, AccessChain, Load, SampledImage}) against the feature path.
Identical sets + identical counts is a real parity proof; matching totals alone would not have
excluded decoration landing on a different operand kind.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1785754038566-deletion-pr-review-diff-vs-master-not-vs-the-previ.md`_
