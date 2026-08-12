---
title: "[approver/calibration] Size-cap ABSTAIN on a large compiler-core PR confirmed well-placed by a month-long human review (slang #11615)"
type: learning
topic: review-approval
source: learnings/1783786027293-approver-calibration-size-cap-abstain-on-a-large-c.md
---

# [approver/calibration] Size-cap ABSTAIN on a large compiler-core PR confirmed well-placed by a month-long human review (slang #11615)

# [approver/calibration] Size-cap ABSTAIN confirmed well-placed on a large compiler-core refactor (slang #11615)

Shadow-mode agreement datapoint, R0 = `f3ed2b90`. On shader-slang/slang#11615 ("Fix generic interface witness lowering", author csyonghe, maintainer) the approver recorded **ABSTAIN_POLICY / CLAUSE_FAIL:tier_eligible** — Step-1 terminal fail: 5146 lines / 40 files > the 2000-line shadow cap. Steps 2–3 (verdict parse, challenger) correctly did not run. The review doc itself was `APPROVE_WITH_NITS` (0 bugs, 4 gaps, 1 question) but also `reviewers_complete=false` (Devin infra-skipped, clarity crashed-but-salvaged). Human outcome: **APPROVED** by saipraveenb25 (2026-07-10), **MERGED** 2026-07-11 (merge commit `8f0c3515`).

**Symptom / question:** abstain vs. an eventual human APPROVE — is the size cap too conservative, i.e. should a large maintainer PR with a clean-ish review doc have been eligible for WOULD_APPROVE?

**Root cause / finding: the abstain was correct, and the human record proves the cap is well-calibrated for this PR *shape*.** This is NOT a false-safe (I didn't approve; the human looked). More importantly the human process for this PR was exactly what "a human must look" is for: review ran ~1 month (2026-06-15 → 07-10), dozens of rounds across two maintainers, an intermediate **DISMISSED** review (07-09), and a **substantive late fix commit landing after R0** — `c1d365f7` "Preserve pack-count diagnostics during recovery" (+10/-7 in `slang-check-decl.cpp`, at 16:10Z the same day). The change was still materially evolving at approval time. A thousands-of-lines SSA/witness-table/conformance refactor is the archetype of a change no auto-approver should clear.

**How to catch it / apply at the NEXT R0 of similar code:**
- Large (≳2000-line) PRs touching compiler-core semantics (witness-table lowering, conformance checking, generic/constraint classification, autodiff IR) will hit `tier_eligible` and correctly terminate at Step 1. Treat this as the system working, not a coverage gap — do **not** lobby to raise the cap to "cover" such PRs. The cost of a wrong auto-approve on this code class dwarfs the coverage benefit.
- Two independent R0 signals pointed the same way here and will recur on this class: (a) the size cap, and (b) `reviewers_complete=false`. When both fire, there is no auto-approve path regardless of ordering — the size cap is just the first/dominant terminal gate. See [[approver-reviewers-complete-field-is-authoritative]].
- Distinct from the OPEN_GAP-merged-over datapoint in [[approver-calibration-maintainer-merged-over-an-abs]]: that was a Step-3 gap the maintainer accepted; this is a Step-1 policy predicate the human process fully vindicated. Both are conservative-abstain-then-human-merged, but only the gap one hints at a possible severity-threshold lever — the size cap on core refactors should stay.

**Fix:** none to the procedure. Record as a well-placed conservative abstain; expect a steady cluster of "large core PR → CLAUSE_FAIL:tier_eligible → human-approved-after-long-review" and score it as correct conservative coverage, not agreement loss.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1783786027293-approver-calibration-size-cap-abstain-on-a-large-c.md`_
