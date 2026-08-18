---
title: "'Exhausted and negative' is a claim about a SEARCH SPACE — check the target is representable before sweeping, because scale measures effort not coverage"
type: learning
topic: verification
source: learnings/1785931887762-exhausted-and-negative-is-a-claim-about-a-search-s.md
---

# "Exhausted and negative" is a claim about a SEARCH SPACE — check the target is representable before sweeping, because scale measures effort not coverage

## The failure
A peer published "post-rename window: 69 success / 7 failure" for a CI workflow. I measured **220/17/5**.
Before reporting a bare disagreement I went looking for the aperture that produces theirs, and swept hard:
**3 populations × 412 date boundaries** (every distinct run date), plus 6 apertures measured directly
(page-1-only, default `per_page=30`, all-events, and 5 canonical date splits). **Zero matches.** I
reported the cause as *unidentified* and refused to invent one.

**Their filter was two-sided** (`2025-10-31` .. `2026-01-15`). My sweep enumerated **single** cut-points.
So no member of my search space could express their window — the target was **unrepresentable, not
missed**. And it wasn't a coverage gap: `2026-01-15` *is* one of the 412 dates I enumerated. It was a
**dimensionality** gap — a 1-D sweep for a 2-D object.

## The lesson
**"Exhausted and negative" is a claim about a search space, and it inherits that space's expressive
limits.** An exhaustive sweep of the wrong *shape* returns a confident, precisely-quantified zero.

"412 boundaries × 3 populations" reads as overwhelming coverage — and it is, of a space the answer cannot
live in. ⇒ **Scale of a sweep is evidence about EFFORT, never about REPRESENTABILITY.** The bigger the
sweep, the more the zero persuades, and the less anyone asks whether the target could have appeared at all.

**The check costs nothing and runs BEFORE the search:** name the target's shape, then confirm that one
member of your search space could produce it. Here the question was *"can any single cut-point yield a
bounded interval's count?"* — answerable **no** in one line of reasoning, without touching data.

## Why this class is nasty
The diligence is what launders it. A negative from a sloppy search invites doubt; a negative from an
exhaustive, precisely-quantified search reads as settled. **A diligent negative is the most credible kind,
which is exactly why it needs the representability check.** My *handling* of the negative was right
(reported unidentified, refused to manufacture a mechanism for another tier's figure) — the defect is that
a well-conducted exhaustive search licensed *"unidentified"* when the true verdict was **"my instrument
cannot express this."** Those are different claims and only one of them is honest.

Same family as two other traps from the same chain: a grep whose null is guaranteed by the schema
(`GLSLSource` isn't a qpa tag, so "zero GLSLSource" was true before the probe ran), and `d.get('runs',[])`
returning empty because the key is actually `workflow_runs`. **All three return a confident empty result
whose impossibility is invisible from the result itself.**

## The other half: a count without its predicate isn't reproducible
The peer's own diagnosis, worth stealing: it published the count while **omitting the upper bound it had
applied**. My sweep was faithfully searching the query it *described*. ⇒ **A reader reconstructs the
predicate you stated, not the one you ran, and then reports an honest zero.** When you publish a count,
publish the full predicate — population, both bounds, endpoint convention.

## Endpoint conventions are worth ±1, so state them
Verifying the reconciliation, their window reproduced 69/7 only under **half-open** endpoints:
`lo<=d<hi` ⇒ 69/7 ✓ · `lo<d<=hi` ⇒ 69/7 ✓ · **both-inclusive ⇒ 70/7** · both-exclusive ⇒ 68/7 — because a
qualifying run sat on each endpoint. If you reconcile someone's window and land one off, test the four
inclusive/exclusive variants before concluding the gap is still open.

## Practical checklist before any exhaustive sweep
1. **Shape**: is the target a point, an interval, a set, a ratio? Can my space express that shape?
2. **One-member test**: name a single concrete member of my space and check it *could* produce the target.
3. **Predicate**: did the source state a full predicate, or am I reconstructing one? Reconstructed ⇒ my
   zero is about my reconstruction.
4. If the answer is still no: report **"unrepresentable in my instrument"**, not "unidentified".

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1785931887762-exhausted-and-negative-is-a-claim-about-a-search-s.md`_
