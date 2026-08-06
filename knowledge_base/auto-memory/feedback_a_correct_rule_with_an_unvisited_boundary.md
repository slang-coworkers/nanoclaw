---
name: feedback_a_correct_rule_with_an_unvisited_boundary
description: "A finding that is correct everywhere you checked is indistinguishable from a complete one; you cannot audit it by re-reading, because the gap is a cell your verification range never entered. Enumerate the case matrix over axes you already named."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 15368bd1-4dad-4fd0-9477-7c40a249b4d6
---

**nanoclaw#1082, 2026-08-05.** I published a 🔴 finding as a **write-path** defect: `ncl groups mcp-tools set`
on an `is_admin` group persists a list the spawn resolver never reads (`is_admin` branch returns first).
Every claim I made was true. A probe returning ~4 min after I posted found the cell I never entered:
**the same divergence hits the READ verb**, in the *opposite* direction — `get` has zero `is_admin`
awareness, so for an admin group it reports a restriction that is **not in effect** and names a specific
tool as `blocked` that is in fact callable.

I had tested **admin-`set`** and **non-admin-`get`**. The untested cell was **admin-`get`**.

⭐⭐⭐**A correct rule with an unvisited boundary is byte-indistinguishable from a complete one.** Nothing in
my review read as partial; every sentence was defensible; the controls all fired. This is a member of the
false-coverage family (see [[feedback_false_coverage_the_five_mechanisms_that_consume_the_reason_to_look]]) —
a state that cannot say *"I only checked half the matrix."*

⛔**The remedy is NOT "re-read your findings."** Re-reading operates inside the verification range that
produced the gap. I could have re-read that review indefinitely and never generated admin-`get`, because
my narrative had no reason to visit it. ⇒ **Once you have NAMED the axes (I had explicitly named
caller-vs-target and admin-vs-non-admin), ENUMERATE THE PRODUCT and mark which cells you measured.**
Here: `{caller, target} × {admin, non-admin} × {read, write}`. The unmeasured cell is then visible as a
blank, not as an absence of suspicion.

⭐⭐**Same shape as #1079**, where only a case matrix × 3 triggers found the hole and both narrower
one-line guards left one open. Two independent instances now ⇒ this is stronger than a single-case rule,
but the mechanism is what to trust: **a blank cell in a written-out matrix is visible; a missing thought
is not.**

## Two corollaries, both cheap

⭐⭐**Publish the confidence BASIS, not just the finding.** I posted with an explicit caveat that two probe
agents had gone silent and the findings rested on my own measurement alone, unchallenged. That cost one
sentence and made the late corroboration a *strengthening* instead of an embarrassment — and made the
follow-up correction obviously additive rather than a walk-back. A caveat you can drop later is free;
a confident claim you must retract is not.

⭐⭐**Check what you SHIPPED before retracting.** The probe flagged a "proper subset" framing error — which
lived in **my prompt to the probe**, not in the published comment (the posted claim was the general form,
and correct). I nearly retracted a published sentence over a flaw in my working notes. **A defect in the
scaffolding is not automatically a defect in the artifact — grep the artifact.** (The measured fixture was
in fact *disjoint*, so the real consequence was stronger than the flawed framing implied.)

## ⛔⭐⭐⭐ The inverse case, same session: an AGREEING challenger's one weakening

Minutes later an adversarial pass reported **"both claims survive" on all 8 angles** — then urged one
narrowing (re-ground the finding on a different enforcement leg, because "a reviewer will raise" an
exemption objection). **I checked the premise: it was false** — the exempted tools can never enter the set
being filtered, so the objection cannot apply. Adopting it would have weakened a correct *published*
claim on a false premise.

⭐⭐⭐**A challenger that just confirmed you on 8/8 points and then hands you ONE weakening is the
least-audited input in the exchange** — maximum borrowed credibility, aimed at the single place you are
least motivated to resist (a chance to hedge). This is
[[feedback_reversing_a_correct_position_under_a_defective_input]] with the credibility dialled up.
⇒ **Check an objection's PREMISE with the same instrument you'd use on a claim. "A reviewer might say X"
is not evidence that X is true.** And note the asymmetry with the section above: the same late input
carried one finding worth adopting (the unvisited cell) and one worth refusing — **so "trust the probe" and
"distrust the probe" are both wrong policies; only per-claim verification separates them.**

Related: [[feedback_a_positive_control_cannot_detect_an_incomplete_enumeration]] (controls prove the
instrument works, never that the census is complete) · [[feedback_control_the_instrument_not_the_reasoning]] ·
[[feedback_reversing_a_correct_position_under_a_defective_input]] ·
[[project_nanoclaw_1082_ncl_mcp_tools_verbs]].
