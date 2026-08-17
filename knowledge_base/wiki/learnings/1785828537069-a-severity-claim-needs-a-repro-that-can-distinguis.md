---
title: "A severity claim needs a repro that can distinguish 'fell back' from 'answered wrong' — and identity bugs recur one axis finer"
type: learning
topic: verification
source: learnings/1785828537069-a-severity-claim-needs-a-repro-that-can-distinguis.md
---

# A severity claim needs a repro that can distinguish "fell back" from "answered wrong" — and identity bugs recur one axis finer

**Two lessons from reviewing a partial fix on slang#12150 (2026-08-04), both about claims a repro cannot support.**

### 1. "Strictly better, never worse" is a claim about a DIFFERENCE, so the repro must separate the two outcomes

A fixer reported an incomplete-fix bug and graded it as safe to ship: *"on pristine master every function gets the entry CU; with my change 3 of 4 become correct and the shared-header occurrence stays on the old fallback ⇒ strictly better, never worse."*

But its own trace said `tu-mod=bmod  common.h -> amod.slang ❌ should be bmod.slang` — resolution to the **wrong includer**, not a fallback. Both statements can be true at once only if the entry point lives in `amod.slang`, which it did: the repro put the entry point in one of the two including files. So **amod's CU == the entry CU**, and the two candidate outcomes are byte-identical in the output:

| outcome | meaning | severity |
|---|---|---|
| fell back to entry CU | generic, same as master | no worse than master |
| resolved to amod (== entry CU here) | confidently wrong specific file | arguably **worse** than master |

For debug info the second is worse than the first: master emitted a known-generic fallback, the change emits a *specific real file that is not the right one*, with nothing signalling doubt. That flips ship/hold. The discriminating configuration is an entry point in a **third** file, separate from both includers — only then do "fallback" and "wrong includer" differ on disk.

**Rule:** whenever the claim is comparative ("no worse than", "strictly better", "regression-free"), the fixture must make the two compared outcomes *distinguishable*. A repro where the buggy answer coincides with the baseline answer cannot support a comparative claim, however carefully the trace was read. This is the coincidence trap one level up: the same fixer had already been bitten three times that morning by fixtures where an entry-point-pinned fallback coincided with the correct answer — and then built the severity repro with the same coincidence in it.

### 2. Identity bugs recur one axis finer — enumerate the axes

Days earlier, on the predecessor PR, a reviewer caught: *"an included `SourceFile` can be owned by a parent manager while its view lives in the TU's manager"* — an identity bug across **managers**, duly fixed. The new bug is the same defect across **occurrences**: `findIncludingNonIncludedSourceFile` matches views by `SourceFile*`, so lowering module *B* finds module *A*'s view of the same physical header and walks back to A's includer.

The fixer's own framing is the keeper: **`SourceFile*` is the wrong identity for a question about inclusion — only the include *occurrence* has an includer.** Generalize: on any identity/aliasing fix, enumerate the identity axes (`file` · `file+manager` · `file+occurrence` · `file+TU` · …) and ask which axis **the question** lives on. Fixing the axis that bit you leaves every coarser-than-the-question axis still aliasing, so the bug returns wearing a finer granularity.

### 3. Corollary — narrowing a candidate set is not making it unique

The proposed fix was "only consider views whose initiating loc belongs to this TU." That still leaves >1 candidate when **two files in one module** include the same header, putting you back to reading one element of a multi-element unordered set — a check that *cannot be validated by running it* (it passes, order-dependently wrong). If you choose "first occurrence", assert and justify it (with an include guard, only the first occurrence parsed the text that produced the decl) and test the two-includers-in-one-TU case; don't inherit the semantics from iteration order.

Also worth noting: a "ship narrower" fallback (bail to the old behavior on ambiguity) is usually **not cheaper** than the full fix — detecting ambiguity requires the same enumeration the full fix needs. Do the enumeration once, then decide select-or-bail. And for debug info specifically, **correct-or-silent beats sometimes-wrong**: a wrong scope actively misleads a human debugger, while a generic one merely omits.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785828537069-a-severity-claim-needs-a-repro-that-can-distinguis.md`_
