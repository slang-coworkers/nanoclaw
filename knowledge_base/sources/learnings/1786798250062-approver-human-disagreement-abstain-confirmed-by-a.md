---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786733963343-zvxvjy
written_at: 2026-08-15T12:50:50.062Z
---

# [approver/human-disagreement] ABSTAIN confirmed by a human CHANGES_REQUESTED — but the human's clarity pass missed the correctness defect the challenger caught

**PR:** shader-slang/slang#12421 @ 8cd02a1b29c3 (re-land macro-expansion-stack diagnostics). My decision: ABSTAIN_POLICY / CHALLENGER_CONCERN. Human join: `tangent-vector` posted **CHANGES_REQUESTED at the same commit** (2026-08-14T18:58Z, ~16h after my decision).

**Calibration outcome — CONFIRMED (abstain was right).** CHALLENGER_CONCERN means "a human must look; not merge-ready." A human requesting changes at the exact decided head is agreement with that call, not a disagreement. This is a clean data point that the abstain state is doing its job: the primary production review reported 0 bugs and would have rounded to approve, but the challenger + Devin routed it to a human, and the human independently declined to merge.

**The non-obvious part — the two of us caught DIFFERENT things:**
- My challenger caught a *correctness* defect: `slang-rich-diagnostics-render.cpp:402` (`buildSectionLayout`) still calls the un-converted `findSourceView` on a raw remapped expansion loc → macro-body errors lose their source line + caret underline under `-enable-experimental-rich-diagnostics`.
- The human's review was a *clarity/presentation* pass: doc comments that describe implementation instead of contract, magic numbers (1024/64) → named constants, "cowardly/CYA" null-checks that should be assertions, and the duplicated chain-walk logic (their `:693` note = the same duplication Claude's Gap#5 and Devin Bug#3 flagged). Their `:919` note ("maybe findSourceView should do the new thing by default, with a separate routine for the non-expansion case") is *adjacent* to my catch but is a design musing — it does NOT identify that `:402` was left un-converted and silently drops source context.

**Transferable lesson.** A human CHANGES_REQUESTED confirming an abstain is NOT evidence that every issue is covered — a human reviewer optimizing for clarity can leave a real correctness defect unflagged. When the abstain is confirmed, still surface the *specific* challenger-verified defect to whoever owns the fix, because the human's stated reasons may not include it. The clarity-vs-correctness split is common: a reviewer who says "this needs a presentation overhaul" has often not done the loc-resolution / call-site-conversion audit. The challenger's correctness catch is additive to, not subsumed by, a clarity CHANGES_REQUESTED.

**Also confirms the sibling learning** [approver/challenger-miss on loc-resolver conversion PRs]: even a careful human reviewer reading the same diff did not catch the missed `findSourceView`→`findSourceViewThroughExpansion` conversion at `:402`. The mechanical "grep the OLD function name tree-wide and audit each remaining caller" is what surfaced it — human review of the changed lines did not.
