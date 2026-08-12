---
title: "A correction inherits the frame of what it corrects — re-derive the replacement from the artifact, not from the claim"
type: learning
topic: verification
source: learnings/1786218877024-a-correction-inherits-the-frame-of-what-it-correct.md
---

# A correction inherits the frame of what it corrects — re-derive the replacement from the artifact, not from the claim

## The pattern

Observed three times in one session (shader-slang/slang#12434 review), across three independent agents:
an agent **correctly identifies a false claim** and then **proposes a replacement that is false in the
same direction**, because the replacement was drafted from the wording of the original claim rather than
re-derived from the underlying artifact.

## Concrete instance

Shipping diagnostic text ended: *"Restructure the code so the operation does not read that value."*

Correctly flagged as false: a `p == nullptr` pointer comparison reads no pointee. Proposed replacement:
*"…so the operation has no operand value to work with."*

**Also wrong, same direction.** Both phrasings locate the defect in *the operation*. The truth, from the
artifact: the `none`-flavored operand is **the pointer value itself** — `legalizeLocalVar` legalizes the
`Empty` pointee to nothing, so the local var legalizes to nothing. The operand cannot exist on that
target at all; the operation is fine.

The discriminator that settled it, one command:

```
-DOP_NE  →  p != q       two pointers, no nullptr, no dereference anywhere
fatal error[E51702] … 'cmpNE' cannot be applied here …     ⇒ fires
```

If the eliminated thing were a *read of the pointee*, a comparison with no nullptr and no dereference
would not fire. It fires ⇒ the pointer value is the eliminated operand.

## Why it happens

Reading a false sentence loads its frame ("what does the operation do wrong?"). The next sentence you
write answers that question — a question the artifact never posed. The original claim's *ontology*
survives the correction of its *content*.

## Rule

**A correction is a claim and needs its own evidence.** Before proposing replacement wording for a
diagnostic / comment / doc:

1. Re-read the artifact the text describes (the test file, the IR, the failing input) — not the text.
2. Name the entity the property actually belongs to. Ask: *is the defect in the actor, the operand, the
   type, or the target?* Frame-inherited corrections almost always keep the original's subject.
3. Check adjacent text: often a neighbouring clause is already correct, and the broken sentence
   **contradicts it**. That is the cheapest tell — here the preceding clause said "the operand has no
   value to act on," which is right, and the final sentence reintroduced a read.

## Related failure in the same family

Same session: reporting "both paths verified end-to-end" after confirming a diagnostic *fired at the
right line* but never that it fired *for the reason claimed*. Both errors share a root: reasoning from a
representation of the thing (the claim, the location) instead of from the thing (the artifact, the
mechanism). See also the companion learning on tests that pass for the wrong reason.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1786218877024-a-correction-inherits-the-frame-of-what-it-correct.md`_
