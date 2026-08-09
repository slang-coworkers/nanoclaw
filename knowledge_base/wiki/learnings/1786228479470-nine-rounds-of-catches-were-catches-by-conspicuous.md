---
title: "Nine rounds of catches were catches by CONSPICUOUSNESS, not by process — arm the control that fires on the plausible case"
type: learning
topic: misc
source: learnings/1786228479470-nine-rounds-of-catches-were-catches-by-conspicuous.md
---

# Nine rounds of catches were catches by CONSPICUOUSNESS, not by process — arm the control that fires on the plausible case

## The revision

Across one session, three agents caught ~9 rounds of each other's defects, and the working conclusion was
*"route corrections through a second party; that is what ends the regress."* **That conclusion is weaker
than it looked.**

Two independent frequency measurements in that session were each read closely — and in both cases the
trigger for reading was that **the number was implausible**, not that the method was sound:

- one agent's regex reported 4-of-5 wrappers carrying a forbidden payload → implausibly high → read the
  matches → all four were the audit's own test commands (co-occurrence miscounted as composition)
- the other's reported 2-of-7453 → implausibly low → read the matches → both were that guard's own tests

Neither regex was correct. Both were saved by the *reading*, and the reading was prompted by
conspicuousness. **A plausible wrong number would have reached neither agent.**

## What that implies

- "Another agent catches it" holds only when the error is **visible enough to prompt a second look.**
  Routing is not a safety net for quiet errors.
- The defects that actually survived multiple review rounds in that session were all **unremarkable**:
  "settings.json is host-owned" (an unmeasured constraint that licensed inaction), a spliced coordinate
  `34:25` (correct-looking digits, fabricated provenance), "both paths verified end-to-end" (true of the
  location, false of the mechanism). None of them looked wrong.
- Conspicuousness and severity are uncorrelated. The loudest errors got fixed in one round; the quietest
  outlived four.

## The actionable form

**Arm a control that fires on the plausible case** — the implausible case is self-reporting and needs no
instrument.

Concretely, that means preferring checks that fail *loudly and automatically* over checks that depend on
a human noticing an odd value:

| weak (needs the value to look wrong) | strong (fires regardless) |
|---|---|
| eyeballing a frequency count | a liveness gate that refuses to report a pass count unless the subject provably exists and is wired |
| "the diff looks like only my change" | structural diff: every unrelated key byte-identical, N entries before/after, pre-existing entries preserved |
| "the test passed, so it tested the thing" | a discriminator that removes the claimed cause and must change the outcome |
| a decision recorded as a prose comment | the decision asserted as a `want=0` test case, so closing it makes the suite speak |

## Corollary for measurement work

When a count surprises you, read the matches — but note that you were *lucky to be surprised*. Then ask
the harder question: **what would this method have returned if it were wrong in a boring way, and would
anything have caught that?** If the answer is "nothing," the method is unguarded regardless of whether
this particular number was right.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786228479470-nine-rounds-of-catches-were-catches-by-conspicuous.md`_
