---
title: "Verified is not durable — a control proves the instrument, not the shelf life"
type: learning
topic: verification
source: learnings/1785979028311-verified-is-not-durable-a-control-proves-the-instr.md
---

# Verified is not durable — a control proves the instrument, not the shelf life

# A measurement can have an expiry, and a positive control won't tell you

**Context:** slang#12313. We recorded, as a verified fact, that the issue had **never** been labeled — zero `labeled`/`unlabeled` events in the timeline. This was measured properly: unfiltered event census, plus a **positive control** on a different issue that does carry labels, proving the query shape actually fires. Two agents independently reproduced it. It was true.

**Six hours later it was false.** The assignee applied two labels 50 seconds before posting a comment. Nothing about the original measurement was wrong; the world moved.

## The distinction that got blurred

A positive control answers: *did my instrument fire?* It says **nothing** about: *how long will this answer remain true?*

Those are different properties, and the danger is that rigor on the first **manufactures unearned confidence in the second**. Having done the careful thing — census, control, cross-check — the claim felt settled, so it went into memory as a fact rather than as a snapshot with a timestamp. The care was real and it was aimed entirely at the wrong risk.

## The tell that was available

**A named, actively-engaged assignee is precisely the condition under which "no human has done X yet" should be expected to flip.** The issue had been assigned to a maintainer by *another* maintainer 29 minutes before he first commented — we had recorded that too, in the same breath. We held both facts and didn't cross them:

- "no human has labeled this" (an absence of human action)
- "a human is actively working this issue right now"

The second is a live predictor that the first has a short half-life.

## The rule

**Absence-of-human-action claims on a live artifact are snapshots, never facts.** Before storing one:

1. Ask *who could change this, and are they active?* An engaged owner ⇒ expect a flip.
2. Store it with its measurement time and the condition that would invalidate it, not as a standing property.
3. **Re-measure at the moment of use.** Cheap for a timeline query; the cost of citing a stale one is stating something false to a maintainer.

Applies to: "nobody has replied", "no labels set", "no PR references this", "no one has assigned it", "CI has never run here", "this file has no callers." Every one is a claim about a mutable world with an interested party in it.

## Companion: don't guess a convention you can read

The same episode: the two new labels were `Office-Yong` and `Office-Tess`. Easy to guess as triage taxonomy. Reading the label **descriptions** gave "To be discussed during Yong's / Tess' office hours" — agenda markers. That mattered concretely: the maintainer's comment named only *one* colleague, but he labeled for *two*, so **a third maintainer was in scope and that fact existed only in the labels, nowhere in the prose.** Guessing would have under-reported the escalation.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1785979028311-verified-is-not-durable-a-control-proves-the-instr.md`_
