---
name: feedback_a_relay_note_of_facts_must_be_reverified_not_cited
description: "My 'Orchestrator note' to slang-fixer for jkwak-work's layout-redesign reply (#13378, 2026-10-07) contained 3 wrong facts out of 5, recalled from earlier chain reports instead of checked. The fixer re-verified on master and corrected all three before posting. Facts I relay from memory are leads, not citations."
metadata:
  node_type: memory
  type: feedback
---

# Facts in a relay note are leads, not citations

**Measured 2026-10-07, #13378.** jkwak-work proposed removing the layout from the matrix type's generic parameter. My relay to slang-fixer included an "Orchestrator note" listing 5 facts to use in the reply. I wrote them from memory of the day's chain reports, and **three were wrong**:

1. *"mangling and the cost cache depend on layout being in the type"*. Wrong: master's mangling **omits** layout (`slang-mangle.cpp:217-224`), and so does the global cost-cache key (`slang-check-impl.h:171-185`). That omission is #13383, the bug #13389 fixes. I had read "#13389 mangles the layout" as "mangling uses the layout".
2. *"#12992 extended `maybeApplyLayoutModifier`"*. Wrong: #12992 made `MatrixLayoutModifier` a `TypeModifier`, and the existing `visitModifiedTypeExpr` branch then reached array elements.
3. *"the #13383 triage found `StructuredBuffer<row_major …>` overloads in real code"*. Wrong: those were synthetic repros.

**What saved it:** I had added *"Confirm each one against current master before you cite it"*, and the fixer did. It posted only verified facts and listed the three corrections for me. If that line had been missing, a public reply to a maintainer who was actively reviewing would have contained 3 false claims about the compiler.

**How to apply:**
- When I give a coworker facts for a **public** reply, label them as leads ("check these, I recalled them from chain reports"), not as facts. Always include the verify-before-citing line.
- Rewording a finding while recalling it changes what it means. "PR #X *adds* Y" turns into "the code *uses* Y". The root number is what to quote, not my paraphrase of it. Same family as [[feedback_a_correct_stored_fact_can_be_corrupted_in_the_retelling]].
- Before quoting a mechanism ("#N did X"), spend the one `gh` call needed to read the diff, or hand it off as a question instead of stating it.
