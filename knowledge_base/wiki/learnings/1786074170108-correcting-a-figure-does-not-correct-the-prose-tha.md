---
title: "Correcting a figure does not correct the prose that explains it — and re-running beats hedging"
type: learning
topic: misc
source: learnings/1786074170108-correcting-a-figure-does-not-correct-the-prose-tha.md
---

# Correcting a figure does not correct the prose that explains it — and re-running beats hedging

## Two lessons from one correction, on slang PR #12378

### 1. A figure sweep is structurally blind to a prose restatement

I corrected a test count in a PR body from `9/10` to `10/10`, then swept for the string `9/10` — **zero
hits, clean**. I shipped a body that asserted `10/10` and, two paragraphs later, still said:

> "The one failure is `gfx-smoke.slang` (*"Failed to load DLL gfx"*), which fails identically on the
> pre-fix binary — environmental, not from this change."

The document asserted a perfect score and explained its failure at the same time. My sweep could not
see it: the contradiction was in **prose**, not in the figure. A reviewer caught it.

⭐ **When you change a value, sweep for its EXPLANATION, not just its digits.** Grep for the dependent
phrasings: *"the one failure"*, *"except for"*, *"because X fails"*, *"which is pre-existing"*. Anything
that only makes sense at the old value is now false, and no numeric search will find it.

This was the third figure-vs-prose contradiction in the same document. The pattern is stable enough to
treat as a rule rather than an accident.

### 2. Re-running beats hedging — it also surfaces what hedging would hide

The reviewer flagged my claim "all these counts are from the rebuilt tree" as overstated: two of the
suites had in fact been run *before* a rebase. The cheap fix was to qualify the sentence ("all except
lambda and cpu-program…").

Instead I re-ran the two suites. One came back **10/10 instead of 9/10** — a long-standing environmental
failure had cleared on the new base, because the upstream commits I'd rebased onto touched that very
subsystem.

⭐ **Hedging preserves an unverified number; re-measuring replaces it with a verified one.** And note the
direction: the stale figure made my own work look *worse* than it was. Hedging would have quietly kept
it, and nothing would ever have prompted a recheck. **A qualifier is not a substitute for a
measurement** — it converts a falsifiable claim into an unfalsifiable one, which feels safer and is
strictly less informative.

### Related trap hit in the same verification

`grep -c '80 check-runs'` returned **0** on a document that contains that exact phrase — it was
hard-wrapped across two lines. Caught only by distrusting the zero and re-checking with
`tr '\n' ' '` first. **A flat grep cannot see a hard-wrapped phrase**, so a multi-word needle in
wrapped prose needs newline-stripping or a single unbroken token.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786074170108-correcting-a-figure-does-not-correct-the-prose-tha.md`_
