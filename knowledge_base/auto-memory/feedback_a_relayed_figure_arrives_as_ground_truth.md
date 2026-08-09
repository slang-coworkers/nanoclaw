---
name: feedback_a_relayed_figure_arrives_as_ground_truth
description: "A subordinate's figure that I relay to another subordinate arrives stripped of its instrument and becomes ground truth to reconcile AGAINST. Measured: I passed a `547` census count to slang-triager as fact; it got 456/564 on different corpora and was one step from publishing 'couldn't reproduce'. Relay the corpus with the number, or instruct re-derive."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 1bee1341-ece7-4919-9c1c-d8fc33208854
---

# A figure I relay downstream arrives as ground truth, with its instrument stripped

**Measured 2026-08-08, slang #12428 chain (discord-support → me → slang-triager).** The Discord
agent reported *"of **547** `^\s*IDENT\s*;$` lines in `tests/`, 543 are keywords"* as evidence that
no enabled test covers the bare-function-ref bug. I put `547` into my dispatch to slang-triager
verbatim, as a fact, with no corpus and no provenance marker. The triager re-derived and got **456**
over `*.slang` and **564** over all file types — three sound measurements of three different file
sets — and was **one step from publishing a "couldn't reproduce this" caveat against a number that
was never wrong.**

**Why this is a routing defect and not just a measurement one:** the numbers were all fine. The
damage path ran through *me*. A figure produced by a peer carries its instrument in the peer's head;
when I forward it, the instrument does not travel. And because it arrives **from the orchestrator**,
the recipient reasonably upgrades it from "a peer measured this" to "this is the established value" —
so its natural move is to **reconcile against** my number rather than re-derive from the definition.
Reconciling two sound-but-differently-scoped counts produces either a false impeachment or a
meaningless average. CLAUDE.md's *"verify before relaying coworker findings as fact"* covers
**diagnoses** ("root cause is X"); this is the same failure for **figures**, and figures are worse
because they look self-evidently checkable and so invite no verification at all.

**The tell that it mattered:** re-deriving from the definition — instead of reconciling to my
number — found something **no total contained**: three of the non-keyword hits (`a`,
`bytesForMMAOtherTargets`, `RAY_FLAG_…`) are **line continuations of multi-line expressions**, not
statements at all. That *strengthened* the coverage gap. Reconciliation could not have found it;
only re-derivation could. Contrast the sibling figure in the same dispatch: `695` catalog codes
**did** reproduce exactly (`grep -c '^[0-9]'` over the catalog TSV), and counting *unique numeric
tokens* there gives `625` — a different quantity that, published as "couldn't reproduce 695", would
have impeached a sound number the same way.

## How to apply

- **Relaying a count means relaying its corpus.** Write *"547 over `tests/**` per discord-support —
  re-derive on your edge, the figure is file-set dependent"*, never a bare `547`. A census count
  without its corpus is unfalsifiable.
- **When two sound measurements of "the same" quantity disagree, the disagreement is information
  about the instruments** — re-derive from the definition; never average, never pick the one from
  the higher tier. See [[feedback_deference_drifts_to_whoever_corrected_you_last]] for the
  higher-tier-wins version of this error.
- **Mark provenance on every relayed figure**, because my dispatch is exactly where a peer's
  measurement gets laundered into an orchestrator fact. Same reason
  [[feedback_audit_credit_as_hard_as_blame]] exists: attribution is load-bearing, not courtesy.
- Related instrument discipline: [[feedback_control_the_instrument_not_the_reasoning]],
  [[feedback_a_catch_site_census_must_split_convert_from_rethrow]] (a census whose grep signature
  merges opposite semantics).
