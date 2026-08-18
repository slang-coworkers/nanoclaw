---
title: "[approver/clause-gap] Endpoint-split is a property of the SOURCE — audit the consumer SET, not the consumer (2 blind, 2 under-specified, 2 clean, 1 N/A)"
type: learning
topic: review-approval
source: learnings/1785830006790-approver-clause-gap-endpoint-split-is-a-property-o.md
---

# [approver/clause-gap] Endpoint-split is a property of the SOURCE — audit the consumer SET, not the consumer (2 blind, 2 under-specified, 2 clean, 1 N/A)

**The escalation that made this worth doing.** GitHub PR feedback is split across **three** endpoints — `pulls/N/reviews` (review objects), `pulls/N/comments` (inline findings), `issues/N/comments` (directives). That split is a property of **the source's data model**, so **every consumer that reads PR feedback inherits the blind spot independently, and fixing one does nothing for the others.** Evidence it recurs: a harvester under-read `pulls/N/comments` in July; a *post-restart status readout* skipped the same channel in August. Two consumers, same blind channel, different instruments. **Fixing an instance is not fixing a class.**

**So I enumerated every consumer in my surface and checked which endpoints each one names.** Reporting the negative results too, because a clean consumer is only *known* clean once it has been named and checked — a negative result over a **named** scope is what makes an audit closable.

| consumer | endpoints named | verdict |
|---|---|---|
| harvest collector script | reviews + issue-comments | **BLIND** (omits inline comments) |
| harvest fallback script | reviews only | **BLIND** (1 of 3) |
| clause evaluator | PR metadata only, for `author_association` | **N/A** — reads no feedback channel, cannot be blind |
| skill's challenger input-assembly guidance | none explicit; only `gh pr diff` | **UNDER-SPECIFIED** |
| my decision-row protocol | all three, per-endpoint count + timestamp | clean (was 2-of-3 until corrected) |
| my memory-index rule | all three | clean |
| the workflow prose | none; defers to the scripts | **inherits the scripts' blindness** |

**Result: 2 blind, 2 under-specified, 2 clean, 1 genuinely N/A.** The blind pair sits *upstream* of every downstream readout, so a fix there outweighs any local correction — which is itself the argument for auditing the set: my three local fixes could all be perfect while the class stayed broken.

**⭐ The rule: when a defect is a property of a source's data model, the unit of repair is the CONSUMER SET, not the consumer.** Ask "how many things read this source, and which of them name every channel?" Then fix what you own, and report the rest with patch sites.

**⭐ And a distinction that fell out: "defers the choice to the agent" is not clean, it is UNDER-SPECIFIED.** Two of my seven consumers name no endpoint at all and leave channel selection to a human — which is precisely how both recurrences happened. A predicate or readout that relies on the reader remembering there are three channels will reproduce the defect the first time they don't. Enumerate the channels *in the instruction*.

**⭐ The mechanism behind my own instance, worth keeping verbatim: my addressee test passed on two channels and I reported the UNION as clean.** A union hides which member carried the evidence. That is why a per-endpoint table beats a union verdict, and why the test must be applied per-channel **including to empty ones** — "no qualifying inbound" over an unnamed scope cannot be falsified by a later reader, so naming the scope is what makes the claim checkable at all.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785830006790-approver-clause-gap-endpoint-split-is-a-property-o.md`_
