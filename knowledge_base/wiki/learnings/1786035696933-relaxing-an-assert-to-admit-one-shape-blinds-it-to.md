---
title: "Relaxing an assert to admit one shape blinds it to a worse one — a tightened-then-loosened invariant is not neutral"
type: learning
topic: misc
source: learnings/1786035696933-relaxing-an-assert-to-admit-one-shape-blinds-it-to.md
---

# Relaxing an assert to admit one shape blinds it to a worse one — a tightened-then-loosened invariant is not neutral

A reviewer found a latent silent miscompile in code I wrote, and the reason it was *silent* was an assert I
had deliberately weakened hours earlier for a good-looking reason. slang#12155, 2026-08-06.

**The sequence, which is the whole lesson:**

1. I wrote two walks that must produce results in the same order — a producer that flattens a nested struct,
   and my new collector that gathers one layout entry per resulting leaf.
2. I asserted the strong invariant: `leafCount == fieldCount`.
3. **The exact assert fired** on a real shape — a field merged in from elsewhere with no layout entry.
4. I relaxed it to `leafCount <= fieldCount` and added a `break`, with a comment explaining the trailing-field
   case. Tests green. This looked like exactly the right response to a firing assert.
5. The reviewer then found that the two walks recurse on **different things** — the producer on the field's
   *type*, mine on the field's *layout* — with an unstated, unasserted implied invariant that a field's type is
   a struct exactly when its layout is a struct layout. A real code path violates it (a recursion-depth cap
   returns a plain layout for a struct-typed field).

A violation yields N flattened fields but 1 leaf, so **every subsequent field pairs with the wrong layout
entry** and gets the wrong output location. Not a crash — a wrong-`@location` miscompile.

**And my `<=` is what hides it.** A positional shift produces *fewer* leaves, so `<=` passes and the `break`
swallows the remainder. The `==` form I deleted in step 4 would have caught it for free, without anyone
understanding the divergence.

**The rule:** when you weaken an invariant to admit shape X, the old form was also catching things you weren't
thinking about. Before relaxing, ask **"what else was this assert catching?"** — and prefer a form that admits
exactly X rather than everything on one side of a comparison. `count == expected || isKnownTrailingCase(...)`
admits X; `count <= expected` admits an entire family, including positional shifts, truncations, and
off-by-N's from causes you haven't discovered.

Corollaries:
- **A firing assert is information, not an obstacle.** Step 3 was the system telling me two walks disagreed. I
  read it as "the bound is too strict" and moved on. The right question was *why* the counts differ, which
  would have led to the pairing mechanism.
- **`<=` / `>=` / `!= null` are the weakest useful assertions.** They tend to be where a strict check goes to
  die. If you find yourself loosening a comparison, consider whether the real invariant is an *equality with a
  named exception*.
- **Order-by-convention between two walks needs an asserted or structural link.** The reviewer's fix direction
  was to build from the correspondence map the flattener already produces, so order is shared **by
  construction** rather than by two functions happening to iterate the same way. Two independent sources had
  pointed me at correspondence-based pairing and I talked past both.

**Separately, a near-miss from the same session worth its own line:** writing an issue describing "the tree,"
I grepped for a symbol and reported the count. The count included **my own uncommitted working-tree change**,
so a draft claimed upstream had three synthesis sites when it has two. When describing repository state in an
outward artifact, exclude (or stash) your own uncommitted diff — otherwise you publish your working copy as
upstream fact.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786035696933-relaxing-an-assert-to-admit-one-shape-blinds-it-to.md`_
