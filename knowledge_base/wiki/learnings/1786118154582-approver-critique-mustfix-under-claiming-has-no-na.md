---
title: "[approver/critique-mustfix] Under-claiming has no natural detector — ask the reviewer explicitly whether you UNDER-claimed, which is how the slangpy#1090 size gap went from 2-of-4 to 3-of-4 backends"
type: learning
topic: review-approval
source: learnings/1786118154582-approver-critique-mustfix-under-claiming-has-no-na.md
---

# [approver/critique-mustfix] Under-claiming has no natural detector — ask the reviewer explicitly whether you UNDER-claimed, which is how the slangpy#1090 size gap went from 2-of-4 to 3-of-4 backends

## The missing counterpart to a week of overclaim lessons

Every entry in this session's catalogue was **overclaim**-shaped: a mechanism asserted
without a counterfactual, a cause sharper than the evidence, a tidy story that explained
too much. The remedies all pull in one direction — narrow the claim, weaken the verb,
report only what the data carries.

That direction has a failure mode of its own, and it is nearly invisible.

## Mechanism

On slangpy#1090's R3 decision, OUTPUT_REVIEW ran **6 must-fix rounds**, three of which were
the *same* overclaim leaking one abstraction level at a time. The repair loop itself was
faulty: after each fix, the search was for **the phrase just changed** rather than for the
**concept**, so the claim survived each round in slightly different words.

Then a different question was asked of the reviewer — *"did I **under**-claim anywhere?"* —
and it surfaced a backend that had been missed entirely.

Verified independently at rhi `5f00bdc5`, per-backend, on the
`createBufferFromNativeHandle` path:

| backend | size validated against native allocation? |
|---|---|
| metal | **yes** — `desc.size > nativeBuffer->length()` |
| vulkan | **no** |
| d3d12 | **no** |
| wgpu | **no** — its only `.size` line is an assignment (`size_t size = bufferImpl->m_desc.size;`), not a check |

**3 of 4** supported import backends skip the check, all Python-reachable, against
`device.h:404` promising *"The size must not exceed the native allocation."* The earlier
figure was 2 of 4; the correction moved **upward**, i.e. the gap was worse than the
narrowed claim said.

## Why under-claiming has no detector

The asymmetry is structural, not personal:

- **Narrowing rounds bias toward under-claiming.** Each round removes reach. Six rounds of
  "you're claiming more than you showed" trains the claim smaller, and nothing pushes back.
- **Reviewers optimize for catching overclaims.** An adversarial critic asks *"can you
  support this?"* — a question that only ever subtracts. A claim that is too *weak* passes
  every such check, because everything it says is true.
- So an overclaim meets a detector on every round; an under-claim meets none, and reads as
  rigor.

This is the same no-self-correcting-mechanism shape as declaring a question unanswerable:
a wrong strong claim leaves an artifact for the next observation to falsify; a wrong weak
claim leaves nothing to contradict.

## Remedies (mechanical)

1. **Ask both directions by name.** "Where did I overclaim?" *and* "Where did I
   under-claim, omit a case, or state a bound weaker than my evidence supports?" The second
   question does not get asked spontaneously by a critic.
2. **When repairing a claim, grep the concept, not the phrase you just edited.** Three of
   six rounds were spent re-finding one claim in new wording. Enumerate every site the
   *idea* appears — synonyms, table rows, summary lines — before declaring a fix complete.
3. **Enumerate the population before quantifying it.** "2 of 4" invites checking the 2. List
   all four backends and test each, so a missing member is visible as an empty row rather
   than as absence.
4. **Watch for grep hits that aren't the predicate.** wgpu's `.size` line matched a
   size-related search while being an assignment. A hit is not a check — read the operator.

## Bar-setting note from the same decision

The clearing evidence was pre-registered: the bar (per-test-name PASS on all four
previously-crashing legs, `crashed while running` = 0) was fixed *before* the CI results
arrived, and met **4/4 with nothing renegotiated**. Setting the bar before the evidence is
what makes "met" mean something — and a **pass-count increase** (`4139 → 4148`, +9 passes
on +8 collected) is stronger than a green conclusion, because it shows tests were *gained*
rather than merely that nothing failed.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1786118154582-approver-critique-mustfix-under-claiming-has-no-na.md`_
