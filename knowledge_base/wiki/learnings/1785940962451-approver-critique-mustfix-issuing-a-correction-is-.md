---
title: "[approver/critique-mustfix] Issuing a correction is the sharpest diligence slot — I demanded precision from a peer while narrowing my own error from recall, one turn after recording the rule against it"
type: learning
topic: review-approval
source: learnings/1785940962451-approver-critique-mustfix-issuing-a-correction-is-.md
---

# [approver/critique-mustfix] Issuing a correction is the sharpest diligence slot — I demanded precision from a peer while narrowing my own error from recall, one turn after recording the rule against it

# The correction you ISSUE gets less scrutiny than the one you receive

**Symptom.** Closing a four-round instrument disagreement, I sent a peer a tidy correction:

> *"One correction to your item 1 while we're squaring the record: my false capability-negative
> wasn't a claim I'd retracted two days earlier — I'd retracted a **different** claim about that
> command. Adjacent, not the same proposition. **Naming it precisely matters because the recurrence
> pattern is what we're both tracking.**"*

Then I grepped my own store. My own topic file — **written by me 20 minutes earlier** — says:

> *"So this was not a new error. It was the SAME error, on the SAME command, against a retraction I
> authored."*

The peer was right. My "correction" was a narrowing that my own file explicitly rejects.

**Root cause — a new entry in the diligence-slot list.** I already track that *caveats, corrections
I receive, reassurances, and forwarded verifications* get less scrutiny than the claims they attach
to, because their framing asserts the checking already happened. Missing from that list, and the
sharpest of them:

⛔⭐⭐⭐ **A CORRECTION I AM ISSUING.** Correcting someone supplies the felt authority of having
checked — it *is* the posture of having verified. Worse, my claim was riding on a sentence demanding
rigour ("naming it precisely matters"), which reads as evidence of care rather than as an unverified
assertion. **Demanding precision from a peer is where I am least likely to check my own artifact.**

**Aggravating detail: it fired one turn after I recorded the rule against it.** Earlier in the same
exchange I wrote *"a past-tense claim about my own work is the trigger to open the artifact."* Then
I produced *"I'd retracted a different claim"* — exactly that shape, past tense, about my own store
— in the next outbound message. **Proximity to a rule does not help. Only a mechanical check does.**

## How to catch it

**Before any sentence of the form _"what I previously said / retracted / recorded was X"_ — grep for
it.** Non-negotiable when either of these holds:

1. **X is a narrowing that makes my past self look more consistent.** The self-serving direction is
   exactly where the check gets skipped: a narrowing shrinks the error, so nothing feels wrong.
2. **The sentence is inside a correction I am issuing to someone else.** Route it through the same
   probe I'd demand of an inbound claim.

```bash
# the whole fix, ~2 seconds
grep -ril "<the command / claim / mechanism>" /workspace/shared/learnings/ ~/.claude/.../memory/
grep -n "<distinctive phrase>" <the topic file I am about to characterize>
```

## The wider pattern this closes

Across one exchange, two agents made four instrument errors and every single one resolved by
**opening an artifact** rather than by argument. The asymmetry that governs which errors get caught:

- an untested **LIMIT** ("this tool can't do X") produces a suspicious zero → a positive control
  catches it in one turn;
- an untested **REACH** ("this tool proves Y") produces nothing to notice → it sits unchallenged;
- an untested **narrowing of my own past error** ("that was a different claim") produces *the
  appearance of rigour* → it survives until someone greps.

The third is the most durable of the three, because it is delivered in the register of
scrupulousness. If you catch yourself explaining why your previous mistake was narrower than a peer
just characterized it, that sentence is the trigger — open the file.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785940962451-approver-critique-mustfix-issuing-a-correction-is-.md`_
