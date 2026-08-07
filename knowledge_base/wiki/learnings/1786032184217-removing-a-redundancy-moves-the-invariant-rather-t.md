---
title: "Removing a redundancy MOVES the invariant rather than eliminating it — and null can become a meaningful value, making the obvious assert wrong"
type: learning
topic: misc
source: learnings/1786032184217-removing-a-redundancy-moves-the-invariant-rather-t.md
---

# Removing a redundancy MOVES the invariant rather than eliminating it — and null can become a meaningful value, making the obvious assert wrong

## The situation

While implementing slang#12284 I stored a beaten overload candidate plus a
`bool hasLocalModuleCandidate` flag. Reading `LookupResultItem`
(`slang-ast-support-types.h:1424`) showed a default-constructed one already carries a **null
`declRef`**, so the bool was a second encoding of the same fact — the "one canonical
representation per value" rule. Removed it; validity became `candidate.declRef.getDecl()`.

## Two lessons, and the second is the non-obvious one

### 1. Removing a redundancy MOVES the invariant; it does not delete it

Before: the invariant was *"these two fields agree"* (bool ⟺ non-null declRef) — local to one
struct, and a reader could see both halves at once.

After: the invariant became *"these two **functions** agree"* — the consumer skips a redundant
scope walk **only because** the producer records exclusively from the call site's own module:

```cpp
// consumer, relying on the producer's contract
auto localModuleDecl = getModuleDecl(localCandidateDecl);
SLANG_ASSERT(localModuleDecl == getModuleDecl(context.sourceScope));
```

Nothing enforced that. It is exactly what drifts when someone later relaxes the recording
condition — and the failure would be silent (a wrong module comparison, not a crash). **After
consolidating duplicated state, ask where the invariant went**, and assert it at the new seam.
A cross-function invariant is strictly more fragile than the intra-struct one you removed,
because no single file shows both ends.

### 2. Once the flag is gone, null is MEANINGFUL — so the obvious assert is wrong

My reviewer suggested pairing the change with "assert the invariant at the construction site",
implying `SLANG_ASSERT(declRef.getDecl())`. That would have been **wrong**: with the bool gone,
null *is* the "none recorded" state and every read branches on it. Asserting non-null would
contradict the design that had just been endorsed.

⭐ **A plausible-sounding assert suggestion that doesn't name WHICH invariant is at risk invites
asserting the wrong thing.** Before adding an assert, state the invariant in words and check it
isn't a value the code legitimately produces. "Assert the invariant" is only actionable once you
can name the invariant.

## Reusable check

When you delete a redundant field/flag:
1. Name the invariant the redundancy was implicitly maintaining.
2. Ask whether the *sentinel value* you now rely on has become semantically meaningful (if yes,
   asserting against it is a bug, not rigour).
3. Find where the invariant now lives — often across a producer/consumer pair — and assert it
   **there**, not at the site you just simplified.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786032184217-removing-a-redundancy-moves-the-invariant-rather-t.md`_
