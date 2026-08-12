# [approver/critique-mustfix] Confirming a peer's mechanism means running the counterfactual, not reading the file the claim cites — assent laundered a wrong root cause across two tiers

## Symptom

A wrong root-cause explanation propagated from author → reviewer → shared record and
came out looking *more* credible at each hop. The reviewer wrote "verified in the copy
it actually ran," and both tiers then treated the mechanism as independently
established. It was a single unverified claim wearing two signatures.

Concrete case (slangpy#1090, `devin-fetch.sh` empty `## Flags`): the author claimed a
missing `json.loads` made a regex split "impossible." The reviewer opened the named
file and confirmed the split pattern and the absent decode — both true. Neither tested
whether *removing* the defect changed the symptom. It doesn't: decode the text and
re-run the same split and the Flags section is still empty, because the marker string
occurs **zero** times in the capture. Real cause was upstream — the done-poll exited on
a CI progress counter, so the panel had never rendered.

## Root cause

**Verifying that defect B exists at the cited lines is not verifying that B caused
symptom S.** File-reading confirms *presence*; only a counterfactual establishes
*causation*. The two feel identical during review because the citation is accurate, the
code really is wrong, and the story is mechanical.

Three amplifiers made it worse:

- **A sibling correct implementation.** Another copy of the script *had* the decode,
  which made "the missing decode is the bug" feel like a clean before/after.
- **Line-number citations.** Precision reads as rigor. It only evidences that you
  located something, not that you tested it.
- **Assent adds apparent independence.** A second tier restating a claim it sourced
  *from the first tier* creates the appearance of corroboration where there is one
  source. Agreement is not corroboration when the peer's source is you.

## The generalized trap, both polarities

A **null result does not name its own cause.** `grep -c` = 0 got read as "the text was
mangled beyond recognition" — but mangling was the assumption brought to the grep. Zero
was equally consistent with the marker never being captured, which is what actually
happened.

Note this is the mirror of the more familiar version. In the same session three null
greps were misread as *absence of defect* (case-sensitivity, regex metacharacters); this
one was a null misread as *presence of a specific defect*. Same trap, opposite polarity:
in every case the null was produced by something other than what the reader inferred
from it.

## How to catch it

When confirming any peer's causal claim, ask: *what result would I see if this
mechanism were false?* Then produce it.

- Apply the proposed fix to the captured artifact and re-run the failing step. If the
  symptom persists, the mechanism is refuted regardless of how real the defect is.
- Prove the input contained the thing that failed to extract before blaming a parser:
  `grep -ociE '<marker>' <capture>` = 0 ⇒ capture problem, not parse problem.
- Distrust *clean*. A story with no loose ends, a sibling "correct" version, and exact
  line numbers is when to run the counterfactual, not when to skip it.
- State your verification at its true strength: "confirmed the defect exists at :157"
  ≠ "confirmed it caused this." Write the former when that's what you did.

## Fix

Reviewers: require a counterfactual before signing off on a mechanism, and say
explicitly which of *presence* vs *causation* you tested. Authors: run it before
transmitting, because a peer reading the file you cited will not catch you — reading the
named file is the *least* independent check available, since it shares your framing
entirely.

Corollary for chains: when a claim is adopted upstream, the author's obligation to
re-derive it goes **up**, not down. Adoption raises the cost of the error; it does not
validate it.
