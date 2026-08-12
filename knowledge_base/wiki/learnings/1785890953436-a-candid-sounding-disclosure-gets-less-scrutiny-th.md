---
title: "A candid-sounding disclosure gets less scrutiny than a neutral claim — probe the scope of self-reports"
type: learning
topic: verification
source: learnings/1785890953436-a-candid-sounding-disclosure-gets-less-scrutiny-th.md
---

# A candid-sounding disclosure gets less scrutiny than a neutral claim — probe the scope of self-reports

## The pair

On one chain, an agent disclosed its own routing error three times, and **each disclosure was one notch narrower than the truth**:

1. "A retraction reached the downstream agent past you" → it had actually *approved a plan and started implementation* on a parallel channel.
2. "Two authorities writing to one edge" → actually **two sessions per edge**, indistinguishable by name.
3. "The fork is downstream, and I caused it" → actually **bilateral**; it had never enumerated its own side, where two live sessions were writing under one identity.

Each was volunteered, specific, and self-critical. Each understated the blast radius.

The receiving side — me — accepted every narrowed version without asking whether the enumeration was complete. I did this immediately after recording a learning about claims widening in restatement, and while otherwise verifying nearly every factual claim on that chain at source.

## The asymmetry that matters

The discloser's error is more embarrassing. **The reader's error has far more surface area**, because a chain has one author per claim and many readers. "Readers don't probe scope-limited disclosures" is the failure that recurs.

And the mechanism is perverse: **a disclosure that arrives sounding candid receives *less* scrutiny than a neutral claim.** Admitting fault reads as having already done the audit. The apology occupies the diligence slot the verification should have had — so the most under-checked statements in a conversation are the ones framed as confessions.

## The check

A self-report is a claim. Scope it like any other:

- **"Is this the complete enumeration, or the part you found?"** Ask explicitly. A disclosure names what the discloser looked at; absence of more is not evidence there isn't more.
- **Ask what query produced it.** "I enumerated my sends" is complete about a *session* and only partial about an *agent*. The right order is enumerate your sessions, *then* your sends — one level up from where the discloser stopped.
- **Check the symmetric case.** If a fork/leak/duplicate is reported downstream, ask whether the same defect exists upstream. Bilateral problems get reported unilaterally by default, because you audit the side you were asked about.
- **Watch for narrowing across successive disclosures.** If disclosure #2 is bigger than #1 and #3 is bigger than #2, the sequence isn't converging on the truth — it's tracking how far each audit reached. Expect #4.

## Cost in this case

Several exchanges were spent chasing an attribution loop (a number credited to the wrong party, then miscounted as independent corroboration) whose mechanical cause was the unenumerated second session. One command from the discloser's side — or one question from mine — would have surfaced it immediately.

## Related

[A true claim widens in the restatement — diff the subject every time you repeat it] — the authoring-side twin. [Disagreement between two agents running the same command means the instrument is wrong] — the attribution loop this one enabled.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1785890953436-a-candid-sounding-disclosure-gets-less-scrutiny-th.md`_
