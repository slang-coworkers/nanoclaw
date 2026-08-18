---
title: "A hedge beside an overclaim is inert — and re-test claims when a new mechanism lands"
type: learning
topic: verification
source: learnings/1786129132904-a-hedge-beside-an-overclaim-is-inert-and-re-test-c.md
---

# A hedge beside an overclaim is inert — and re-test claims when a new mechanism lands

# We published a false claim three times, with an accurate disclaimer sitting next to it

**Context:** slang#12313. A reporter said `-obfuscate` breaks name-based reflection. We read the source, found `addLinkageDecoration` hashing every non-core **linkage name**, and published:

> *"analysis is from a source read at `master` HEAD `4d8fa2e9d`, **not a runtime experiment**"* … *"There is **no** carve-out for `public` / uniform / cbuffer / reflected symbols, so `findParameterByName` **does break exactly as you describe**. That part is legitimate."*

A senior architect challenged it a week later. **He was right.** Measured: `-reflection-json` is **byte-identical** with and without `-obfuscate`, every parameter name present, guilty control absent — while the emitted HLSL loses all names, proving obfuscation was active in the same run. Obfuscation operates at **IR** level; reflection vends from **AST**-level data. Two different layers.

## Defect 1: the hedge named the gap and did not stop the claim

Both sentences are in the same comment, adjacent. The disclaimer was accurate, honest, and **completely inert** — it documented the risk instead of blocking it. Worse, it *bought credibility*: a reader sees methodological care and trusts the conclusion more.

**Rule: if a hedge says "not measured", the claim it guards may not use the word "confirmed."** The hedge must constrain the claim's strength, not merely annotate it. Concretely — "source read suggests X; unverified at runtime" is publishable. "Not a runtime experiment" followed by "X does break, that part is legitimate" is not. If you catch yourself writing both, the hedge is telling you which word to delete.

**Corollary — an inference across architectural layers is not a source-read result.** Reading that layer A mangles a name, and concluding that an API at layer B fails, is a *hypothesis about layer B*. Nothing in the layer-A source can confirm it. Any claim that crosses a layer boundary needs a measurement at the layer you're making the claim about.

## Defect 2: we held the refuting evidence and spent it on something else

Two days before the challenge, we measured something else on the same issue: stripping SPIR-V `OpName`s left reflection working, **"because Slang serves reflection from its own layout data, not the stripped names."**

That is *exactly* the architect's mechanism, and it contradicts our own published claim. We cited that sentence **three times** in support of a different point and never once turned it back on the earlier claim it undercut.

**Rule: when a new fact establishes a MECHANISM, re-test every earlier claim that rested on the opposite mechanism.** A measurement's blast radius is not the question you ran it for. On learning "reflection comes from layout data, not names," the immediate follow-up is: *what have I already said that assumed reflection comes from names?*

This is why the error survived scrutiny — every individual step was defensible, and the contradiction lived in the *relationship* between two claims neither of which was being examined at the same time.

## Defect 3: we never checked the symbol existed

The whole chain discussed `findParameterByName` for a week. It has **zero** hits in `include/` and `source/` — it is a helper defined inside one unit-test file. We inherited the name from the reporter's prose and never grepped it.

**Rule: grep every API name you repeat, the first time you repeat it.** A symbol taken from a bug report is an unverified claim, exactly like any other. Cost here is real: part of the analysis was framed around an API whose behavior wasn't ours to reason about.

## The compounding cost: a false premise reframes everything downstream

"`-obfuscate` breaks reflection" wasn't a detail — it was the accepted **premise of the entire feature request**, ours and the reporter's. When it fell:

- the reporter's actual problem became **unknown** (a serialized-AST issue? a separate import-resolution failure they'd mentioned in passing?);
- an open design question we'd been carefully pushing to maintainers — *should `-obfuscate` exclude public/reflected decls?* — **may be moot**: a fix for a defect that may not exist. It's now held with its premise explicitly in doubt, un-revivable without re-deriving the premise.

**When you retract a claim, audit what was built on top of it.** A retraction that only corrects the sentence leaves every downstream inference standing on nothing.


---

## Why this class of error is expensive: a false confirmation terminates the reporter's own search

Added after the retraction, because the cost accounting is the part that motivates every rule above.

Compare what the two honest options cost a bug reporter:

- **"I don't know — here is what I measured and what I didn't."** Costs them a day. They keep looking, and they look in the right place.
- **"Confirmed."** Cost this reporter **a week of not investigating the actual cause.** They had a plausible diagnosis, we told them the compiler team had verified it, and they reasonably stopped. Whatever they actually hit — a serialized-AST consequence, an import-resolution failure they'd mentioned in passing — went uninvestigated because we closed the question for them.

It also pulled **two additional maintainers** into reasoning from a premise that wasn't true, and produced a proposed fix (a carve-out on an existing flag) that may address a defect that does not exist.

**So the ranking is not "confirmed > uncertain > wrong." It is "measured > uncertain > falsely confirmed."** An uncertain answer leaves the search running; a false confirmation stops it and points it away. This is the concrete reason a hedge may not sit beside the word "confirmed" — the hedge protects *you*, but the reporter acts on the claim.

## The counterfactual trap: don't let a mistake take credit for its own remedy

When this was retracted, the first framing that came to mind was generous: *"the design intent is now documented with evidence rather than resting on one architect's recollection — arguably a better outcome than if we'd never erred."*

That comparison is rigged. The alternative to *error → challenge → measurement* is not *no error → no documentation*. It is **running the 30-second measurement on day one** — which produces the *same* artifact, with no maintainer challenge, no week of a false premise steering the work, and no spurious fix proposal. The evidence was produced only because we were caught.

**Rule: when accounting for a mistake, the counterfactual is "I did the cheap correct thing at the start," never "this never came up."** Any framing where the error appears to have generated value is measuring against the wrong baseline. What legitimately survives here is narrow and worth stating as such: the design intent is on the record with evidence, and answering an architect's open question with a measurement rather than a concession is what made the reply useful to him.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1786129132904-a-hedge-beside-an-overclaim-is-inert-and-re-test-c.md`_
