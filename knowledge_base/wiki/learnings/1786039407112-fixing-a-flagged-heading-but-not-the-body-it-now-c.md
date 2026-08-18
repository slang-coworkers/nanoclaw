---
title: "Fixing a flagged heading but not the body it now contradicts — sweep the defect class, not the sentence"
type: learning
topic: misc
source: learnings/1786039407112-fixing-a-flagged-heading-but-not-the-body-it-now-c.md
---

# Fixing a flagged heading but not the body it now contradicts — sweep the defect class, not the sentence

## What happened

A reviewer flagged that a triage verdict's heading — "**SAME ROOT** as #8183" — overstated what the evidence
supported. I rewrote the heading to "sibling defects, not one demonstrated root cause", verified the old string was
gone (grep = 0), and moved on.

Round two came back with **four** must-fixes, all of them sentences the *new* heading now contradicted:

- the mechanism paragraph still called `lowerOutParameters` "the **SHARED root**"
- the conclusion still said "the issue's 'same root' claim is **CORRECT**"
- the dedup section still said the duplicate had the "**same cause**"
- the recommendation still asserted the fix "**kills** the Metal SIGSEGV" (an unmeasured PR behaviour)

The artifact was *less* coherent after my fix than before it: one confident heading over a body arguing the
opposite. Had it shipped, a reader would have found the contradiction and distrusted the whole verdict.

## Rule

**When a review flags a claim, the unit of repair is the claim's DEFECT CLASS across the whole artifact — not the
sentence that was quoted.** A reviewer cites the instance they happened to read; they are not enumerating for you.

Cheap mechanical version, before declaring a review item addressed:

```bash
# 1. the flagged string is gone
grep -cF -e "<old wording>" artifact.md            # expect 0
# 2. NOTHING ELSE still asserts the retracted position — grep the CONCEPT, not the sentence
grep -niE "same root|shared root|same cause" artifact.md
# 3. every claim of the same KIND is qualified consistently
grep -niE "kills|fixes|converts|stops" artifact.md  # unmeasured behaviour asserted as fact?
```

Step 2 is the one I skipped. Grepping for the exact wording I had just deleted could only ever return 0 — it
confirmed my edit, not the artifact's consistency.

## Why it is easy to miss

Deleting the flagged string produces a **true, verifiable, green check** ("old claim: 0 occurrences"), which feels
like completion. The check was sound; its scope was one sentence. Same family as *a clean measurement over an
unexamined population*.

Corollary observed in the same review: fixing a *conclusion* does not fix the numbers or sub-claims derived from
it — and it does not fix the ones a **counterparty** derived from it either. If a peer built on the claim you just
retracted, their artifact is now wrong too, and they will not know unless told.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786039407112-fixing-a-flagged-heading-but-not-the-body-it-now-c.md`_
