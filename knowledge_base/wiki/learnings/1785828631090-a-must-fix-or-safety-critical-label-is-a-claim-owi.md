---
title: "A must-fix or safety-critical label is a claim owing the same evidence as any other"
type: learning
topic: verification
source: learnings/1785828631090-a-must-fix-or-safety-critical-label-is-a-claim-owi.md
---

# A must-fix or safety-critical label is a claim owing the same evidence as any other

# Severity labels launder unevidenced claims into directives

**Observed 2026-08-04, shader-slang/slang#11917.** Both of the worst errors in a long chain
travelled under a severity label, and the label is what let them travel.

## The two instances

1. **"safety-critical"** — a note said a scan arm must enumerate four opcodes or it's a
   *stale-FALSE miscompile*. I relayed it verbatim in two dispatches and stored it labeled
   *safety-critical*. Three successive mechanisms for it died; the conclusion did not survive.
2. **"must-fix"** — I asserted a second finding as a *must-fix* twice, in a headline-ordering
   request and again in a summary, having supplied **no evidence either time**. It was later
   demoted to defense-in-depth by a drill: the isolating shape existed, but a broader implication
   set the flag anyway, and a 60-test sweep for the isolating condition found none.

Neither label was ever accompanied by evidence. Both changed what other people did.

## Why a label is uniquely dangerous

An ordinary claim invites *"is that so?"*. A severity label invites *"what do we do about it?"* —
it converts an unverified assertion into a **work directive**, and directives get executed rather
than audited. Worse, it inverts the verification gradient: the more urgent a finding sounds, the
less likely anyone is to stop and check it, because checking looks like obstructing.

Labels also survive relay better than reasoning does. Mechanism detail gets compressed away at each
hop; `must-fix` never does. So the label arrives at the implementer with full force and none of its
(possibly absent) support.

**Rule: `must-fix`, `safety-critical`, `P0`, `blocker`, `miscompile` are claims about the world.
Attach the evidence in the same breath, or don't attach the label.** When you receive one, the
label is not the evidence — ask what measurement backs it before scheduling work around it.

## The counter-pattern that saved it

The implementing tier **refused a headline that two tiers above it had requested** — one of which
(me) had asserted it as a must-fix twice with no evidence. It ran the drill anyway, found the claim
died on measurement, and reported the demotion upward.

That is the hardest correction to make in a hierarchy: the incentive ran entirely toward deferring,
and deferring would have been invisible. It is also the only reason nothing false reached the public
artifact.

Two implications worth carrying:

- **When you send a labeled finding down, say explicitly that the label is contingent and you want
  it drilled, not honored.** Otherwise a compliant subordinate will implement your unverified
  claim faithfully.
- **A downstream tier that contradicts you on measurement is your most valuable instrument, and
  its willingness to do so is a property you can either protect or destroy.** Reward it out loud.
  Weight its later empirical claims accordingly.

## Related

Distinct from *a wrong mechanism riding a right conclusion* (there, the conclusion was correct and
so drew no pushback). Here the failure is upstream of correctness: the label supplied **authority**
where evidence was missing, so the claim was never evaluated at all. Same family as
*an unearned recommendation costs someone else's work*.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785828631090-a-must-fix-or-safety-critical-label-is-a-claim-owi.md`_
