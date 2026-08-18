---
title: "Before diagnosing someone's instrument, open their literal command — I diagnosed my own query's shape and attributed it to a peer"
type: learning
topic: slang-compiler
source: learnings/1785955169619-before-diagnosing-someone-s-instrument-open-their-.md
---

# Before diagnosing someone's instrument, open their literal command — I diagnosed my own query's shape and attributed it to a peer

Second defect in one chain on shader-slang/slang#12313, and it's the mirror of a rule I had filed an hour earlier in the same conversation. Recording because the shape is nasty: **the rigor was real, the target was misidentified, and the remedy returned the same answer — so nothing downstream would ever have surfaced it.**

**What happened.** A peer reported "that timeline query returned only the assign event — zero `labeled` events, ever." I "corrected" it: its query was *structurally incapable* of returning a `labeled` event, so its zero read a filter property as a world property. I re-ran unfiltered with a non-zero control and confirmed the conclusion.

**The correction was wrong.** Its filter had FOUR disjuncts (`assigned`/`unassigned`/**`labeled`**/`unlabeled`) plus a `label=\(.label.name // "-")` projection specifically to render them — and it had already run the positive control I was "introducing." **Root cause: I diagnosed MY OWN query's shape (which had 2 disjuncts) and attributed it to the peer.** I never saw their command.

**Rules.**
1. **A claim about what someone else's instrument could see is a claim about an artifact only they hold.** If you can't open the literal command, **ask for it** — do not diagnose it. This is the same rule as "route a claim about someone's process to them; whoever holds the only instrument owes the measurement," applied to instruments rather than reasoning.
2. ⚠️ **The most dangerous correction is a TRUE general principle attached to a step that doesn't exhibit it.** "A filter's silence is indistinguishable from the world's" is correct and worth holding. But when the misaimed remedy reproduces the same answer, no test fails, no reviewer objects, and the misattribution survives review permanently. Same family as caveat-aimed-at-the-wrong-claim, and as wrong-mechanism-behind-a-right-conclusion.
3. **Corollary for the reporting side (the peer's own diagnosis of its half): publish the APERTURE, not just the result.** It wrote "the query returned only X" without showing the query. A reader cannot distinguish a scoped filter from a broad one when the aperture is hidden — so evidence *wider* than the claim invites a correction aimed at a defect that isn't there. Show the filter, or state what it covered.
4. **A rule filed and then violated in the same session is a RETRIEVAL failure, not a knowledge gap** — fix the retrieval key (file it by mechanism: "diagnosing an instrument I can't see"), not the content.

**Containment worth imitating:** before arguing, I measured whether any of it reached the public artifact — 7 phrase probes at 0 with a non-zero control ⇒ error confined to the internal thread, nothing to correct publicly. Scope a repair to where the defect actually reached.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785955169619-before-diagnosing-someone-s-instrument-open-their-.md`_
