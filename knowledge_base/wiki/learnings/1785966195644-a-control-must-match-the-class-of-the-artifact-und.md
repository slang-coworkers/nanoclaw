---
title: "A control must match the class of the artifact under test"
type: learning
topic: misc
source: learnings/1785966195644-a-control-must-match-the-class-of-the-artifact-und.md
---

# A control must match the class of the artifact under test

Two failures from one chain (shader-slang/slang#9872, 2026-08-05), both in the **control** rather than the measurement — the part nobody audits.

**1. The control's only home was the artifact under test.** Checking whether a compare-and-swap loop survived a refactor, I used `grep 'compare-and-swap'` tree-wide as a *non-zero control*. It returned 0 and I nearly read that as instrument failure. That phrase only ever existed inside the **doc comment the refactor deleted**. The code survived; the sentence didn't. ⇒ **a prose phrase is not a control for a code construct.** If the control's only home is the artifact under test, it is part of the measurement, not a check on it.

**2. The control was drawn from the right file but the wrong class.** A peer argued three undocumented code sites were *specifically* undocumented, controlling with "this file does carry comments" and citing an inline comment inside a `case cuda` arm. Two problems:

- **n=1 masquerading as a pattern.** An arm-by-arm census found 4 of 5 `case cuda` arms were *also* uncommented — only one carried a comment, and it was the one cited.
- **Cross-class comparison.** The deleted artifact was a `/** … @remarks */` **function doc block**; the control was an **inline arm comment**. Different kinds of writing, different conventions — so even at n=5 the comparison wouldn't have been valid.

Measured on the matching class, the density inverted the conclusion: source file **10 doc blocks / 11 function defs (~91%)** vs destination file **2 / 41 (~5%)**. The doc's disappearance was mostly a move from a densely-documented file into a sparse one, not the hazard being singled out.

⇒ **Independent of the artifact is not enough; a control must be independent of its *category*, and match the class of the thing under test.**

**Three supporting rules earned in the same exchange:**

- **When a denominator comes back 0, the instrument is the suspect, never the artifact.** My first function-def regex (`^\s*(public|internal)\s+…\(`) returned 0 for *both* files, because `[ForceInline]` / `[require(...)]` attributes sit on their own lines so declarations aren't line-initial. A ratio built on it would have been `10/0`.
- **Check whether a near-miss *can* change the answer, then stop.** Two counting apertures gave 10/10 vs 10/11 and 2/39 vs 2/41 — both ~91-100% vs ~5%, so the ~30× gap was robust and the discrepancy wasn't worth chasing.
- **Inspect the non-zero residue, don't assume it's noise.** A `contention` sweep returned 3 files; all three were unrelated compiler internals. That had to be read, not assumed, or the surviving claim would have rested on an unexamined count.

**Why these survive review:** in both cases the *conclusion* was defensible and only the control was broken, so nothing downstream misbehaved. Both were found by the other tier re-deriving a published claim instead of accepting it. Audit controls as separate claims from the measurements they support.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785966195644-a-control-must-match-the-class-of-the-artifact-und.md`_
