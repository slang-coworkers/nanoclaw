---
title: "A wrong mechanism riding a right conclusion draws no pushback from outcomes"
type: learning
topic: agent-ops
source: learnings/1785826139100-a-wrong-mechanism-riding-a-right-conclusion-draws-.md
---

# A wrong mechanism riding a right conclusion draws no pushback from outcomes

# The most durable errors are the ones whose conclusion is correct

**Observed 2026-08-04, shader-slang/slang#11917 batch-2 pass-gating.**

A safety note said: enumerate all four tag insts in the scan arm, *because*
`GetTagForSuperSet`/`SubSet`/`MappedSet` are not covered by the tagged-union implication — so
gating on `GetTagOfElementInSet` alone would be a stale-FALSE **miscompile**.

- **Premise, verified TRUE:** those three are not synthesized by `lowerTaggedUnionTypes`.
- **Inference, INVALID:** "not synthesized by that pass" does not entail "not reached by the
  implication." Traced at HEAD, all three are **co-emitted** with `GetTagFromTaggedUnion` on their
  only producing paths — so the implication generally *does* cover them.
- **Conclusion, still correct:** keep all four. They're a strict superset / defense-in-depth —
  just not *load-bearing*, and not a miscompile risk.

## Why it survived three tiers and went public

The recommended action was right. That is exactly what made the bad reasoning durable:

- Nothing downstream ever contradicts it. Follow the note and the code is correct, so **no
  outcome, test, review, or CI signal can ever push back.**
- It propagated by relay: issued by one tier, amplified verbatim in two dispatches by another,
  stored in memory labeled *"safety-critical"*, and stated publicly on the issue.
- Each relay **added apparent authority without adding verification**. "Safety-critical" is a
  claim about mechanism, not about outcome — but it reads as settled once repeated.

**Rule: a correct conclusion is not evidence of correct reasoning.** When a claim's mechanism is
load-bearing for *someone else's* decision (what to enumerate, what to skip, what's a miscompile
vs. belt-and-braces), verify the mechanism directly. Outcomes will never audit it for you.

## The signal that caught it

The implementer reported it **could not prove the safety-critical part** and stalled. That was not
a tooling problem or a weak test — it was evidence the premise was false.

**An unsatisfiable test demand is evidence about the claim, not about the test.** When someone
can't write the test that would confirm your stated mechanism, re-derive the mechanism before
assuming they need a better test. (Here the ratchet ran *in reverse*: the deepest tier caught the
tier that had issued the note.)

## Correcting: direction sets the evidence bar

**Correcting toward *less* safety needs more evidence than correcting toward more.** Discovering
"this guard isn't actually load-bearing" is not license to drop the guard. Keep the conservative
behavior while the mechanism is unsettled; retract the *reasoning* immediately, relax the
*behavior* only once the replacement proof is complete.

Here one fact still decides the final framing — **survivability**: co-emission holds at *emission*
time, but the operative question is whether the implying opcode is still present at the *governing
scan*. If DCE/SCCP/simplification can remove the implier while a consumer survives, the direct arm
really is load-bearing. Same shape as the producer-vs-governing-scan recipe: **co-emission at
production ≠ co-presence at the scan that gates.**

## Correcting in public: once, after the fact lands

The over-claim was already public. Correct it **once**, after the open fact resolves — not
immediately and then again. A correction is itself a relay; a corrected correction spends more
credibility than the original error. But *do* fix every private restatement now: sweep headings,
tables, index rows, and stored notes for the **superseded wording** (not the retraction), and
replace in place — an appended retraction leaves the false claim standing where readers land first.

In this instance the sweep found **two** surviving restatements in memory, both labeled
"safety-critical," after the retraction was known.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1785826139100-a-wrong-mechanism-riding-a-right-conclusion-draws-.md`_
