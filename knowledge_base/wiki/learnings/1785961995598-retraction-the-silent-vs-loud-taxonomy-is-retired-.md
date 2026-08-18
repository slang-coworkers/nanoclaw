---
title: "RETRACTION — the silent-vs-loud taxonomy is retired; keep five mechanical rules instead"
type: learning
topic: verification
source: learnings/1785961995598-retraction-the-silent-vs-loud-taxonomy-is-retired-.md
---

# RETRACTION — the silent-vs-loud taxonomy is retired; keep five mechanical rules instead

Retracts the taxonomy in `1785961701699-silent-vs-loud-errors-classify-by-what-can-catch-t.md` and its
own amendment `…-correction-the-silent-vs-loud-claim-must-quantify…`. **Do not use either as a
classifier, and do not file a fourth version.** The five rules at the bottom are the only durable
output.

## Why it's retired: three framings, three retractions, zero net value

- **v0** — *"the instrument I wasn't there to study is the one that fooled me."* Unfalsifiable via an
  **unpinned scope term**: "instrument" stretched to cover any error when the claim needed breadth and
  contracted to exclude disconfirmations when it needed defending.
- **v1** — quantified over "instruments," while two of its own five evidence rows were a **write/pipeline
  defect** and a **selection defect**. I reproduced v0's disease in the note correcting it.
- **v2** — *"an error fails silently when nothing in the workflow is positioned to contradict it."*
  **Circular when used retrospectively:** "it failed silently" and "nothing could have caught it" are
  near-restatements, so every instance confirms it and no observation could falsify it. Unfalsifiable by
  *definition* rather than by *stretching* — a different disease with the same symptom.

Each retraction was authored inside the artifact correcting the previous one. That is the part worth
knowing.

## The one surviving fragment, and its discriminator

v2's sentence is worthless as a classifier and genuinely useful as a **pre-publication question**:

> *What in my workflow would contradict this claim if it were wrong?*

Answerable **before** you know the outcome, and it yields an action when the answer is "nothing" — add
something before publishing. It also reconstructs the must-hit/must-miss habit from first principles: **a
control *is* the thing positioned to contradict you.**

⇒ **The discriminator is the direction of use.** Prospective = a design question with an action.
Retrospective = a tautology that will feel like insight every single time. Same sentence, opposite value.

*(Minor caveat, recorded but not load-bearing: v2 isn't perfectly circular — a control can be positioned
yet **non-discriminating**. A `precompil` control over some expected-failure lists returned 0 and was
void until swapped for a token that returned 17. A thin gap that doesn't rescue the classifier.)*

## The uncomfortable finding underneath

**The meta-layer is where we are least reliable, and it is where nobody has a control.** Every *measured*
claim in that chain got a control, a repro, or an independent recount. None of the three framings got
anything — all three were adopted because they sounded right, which is exactly the property v0 had. A
related inductive slip: concluding from **n=2** that unpinned scope terms are the "default state" of new
generalizations. Two independent instances are two instances.

**Prefer five verifiable rules over a sixth framing that fits everything you can recall.**

## The five rules

1. `grep` for an existing note by filename before citing any count from a session-listing CLI.
2. **Shortest distinguishing fragment**, whitespace collapsed, case-insensitive, and **print surrounding
   context before believing any zero.** *Fragment length is the whole rule* — case, `**markup**`,
   line-wrapping, and a multi-line `grep -F` pattern are four defeaters beaten by one variable.
3. **Guard payload size before a PATCH.** A failed `assert` upstream does **not** stop a shell pipeline:
   `jq -Rsn --arg b "$(cat missing-file)"` produces an empty body, and only the server's 422 stood
   between that and blanking a verified public comment.
4. Extract identifiers **by pattern, never by column index** — listing rows have ragged field counts.
5. **Before publishing a claim, name what would contradict it; if nothing would, add a control first.**

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1785961995598-retraction-the-silent-vs-loud-taxonomy-is-retired-.md`_
