---
title: "Splitting a file is a content move, and moved text arrives unmarked — relocation is a BETTER vector for stale claims than rewriting, because rewriting at least puts you in contact with the words"
type: learning
topic: verification
source: learnings/1785780663367-splitting-a-file-is-a-content-move-and-moved-text-.md
---

# Splitting a file is a content move, and moved text arrives unmarked — relocation is a BETTER vector for stale claims than rewriting, because rewriting at least puts you in contact with the words

## The failure

A decision row grew past the 24,400-byte Read limit and was silently truncating, so I split it: parent keeps the conclusions, child takes the derivations and retraction history. I ran the checks that felt relevant — byte sizes on both halves, bidirectional links, positive confirmation that the moved content was present, no content lost.

All four passed. And I had just moved a paragraph asserting *"Resolution needs `SLANG_RHI_METAL_NO_RESIDENCY_SET` (forces fallback)"* and *"Merged unverified on that config"* into the child — **both claims inverted hours earlier in the same session.** I relocated stale text, verbatim, into the very file whose stated purpose is holding retractions, with no marker on it.

Caught only by grepping the destination for the retracted wording afterward. Fixed by putting a `[!WARNING] HISTORICAL — superseded on one point` banner over the section that quotes both retracted phrases and names what replaced them.

## Root cause — the checks that fire are the mechanical ones

**Splitting feels like pure mechanics.** No claims are being changed, nothing is being rewritten, no argument is under revision. So the checks that come to mind are structural: sizes, links, nothing dropped. Staleness never enters the frame, because *nothing was authored* — and staleness feels like an authoring concern.

That framing is exactly backwards. **A move preserves the old belief perfectly.** Rewriting a passage at least drags your eyes across the sentences, giving a stale claim one chance to look wrong. A move is byte-preserving by design: the words arrive at the destination in the state they were written, carrying whatever belief was current *then*, and now sitting under a fresh heading with a fresh timestamp that makes them look reviewed.

Worse, the destination is usually the *archive* or *detail* file — the one a future reader treats as "the supporting evidence," i.e. more authoritative about mechanism than the summary. Stale mechanism claims land where they will be trusted most.

## Split checklist — four items, not three

1. **Sizes** — both halves under the read limit, with headroom recorded.
2. **Links** — bidirectional parent↔child, and no pointer resolving into bytes that get dropped.
3. **Positive content** — the moved text is actually present at the destination (grep the new location for it; a move that silently dropped a section fails no other check).
4. **Staleness of relocated text** — sweep the destination for every claim the session has since retracted, using the **abandoned vocabulary**, not the current wording.

Item 4 is the one that gets skipped, and it is the only one that catches a correctness defect; the other three catch structural defects.

```
# after any split/move, in the DESTINATION file:
grep -nE "<retracted phrase 1>|<retracted phrase 2>|<old vocabulary>" child.md
# every hit must sit under an explicit HISTORICAL/RETRACTED banner, or be a
# quotation inside one. Then a positive control so the sweep isn't vacuous:
grep -c "<corrected wording>" child.md   # expect > 0
```

Note the by-construction property of a correct result: a retracted phrase should appear **twice** — once quoted inside the warning, once in the historical text the warning governs. That duplication is deliberate, and it is what makes a future rewrite trip over the retraction instead of silently restoring the claim.

## A second-order note on crediting the check

A peer audited their own split after reading this and found four retracted phrases in their child file, all sitting under explicit `RETRACTED` markers. But the markers were there because the block had been fully annotated *before* the move — not because any staleness check ran. Split one turn earlier and the unannotated versions would have travelled identically.

Recorded as **a pass by luck of ordering, not by verification.** *A check you didn't run cannot be credited for an outcome it didn't cause* — the same distinction as a right answer resting on a control that could not have produced the cited output. When a clean audit result surprises you, establish whether the mechanism you'd credit was actually exercised before filing it as evidence the practice works.

## Why the split was needed at all — the growth trap

Worth recording alongside, because it is what forces the move: a hoisted "controlling state" block that documents *why each retraction was retracted* **grows without bound.** Every correction adds a layer, and no layer can be deleted — deleting it is what lets a future rewrite restore the claim. Two measured instances: one block reached 6,249B, another 7,468B (35.5% of its file), and one row went 1,001 bytes **over** the limit and was truncating.

The rule that keeps it bounded: **the controlling block carries conclusions and do-not-reintroduce markers ONLY; every derivation lives in the child.** Applying it took one row from 21,040 → 15,779B and another from over-limit to 2,228B of headroom.

And re-run the visibility check after *every* edit to a hoisted block, not once — a block can grow until it evicts its own contents past the limit, which happened to the marker `do not tidy this block away` itself.

<sub>🤖 Generated by an automated Slang coworker — may be inaccurate. A human maintainer should verify.</sub>

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1785780663367-splitting-a-file-is-a-content-move-and-moved-text-.md`_
