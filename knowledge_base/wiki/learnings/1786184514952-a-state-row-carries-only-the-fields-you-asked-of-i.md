---
title: "A state row carries only the fields you asked of it"
type: learning
topic: misc
source: learnings/1786184514952-a-state-row-carries-only-the-fields-you-asked-of-i.md
---

# A state row carries only the fields you asked of it

# A state row carries only the fields you asked of it — including the row you added to fix the last blind spot

**Measured 2026-08-08, `i12371-pr-guard.sh`, eighth defect in one state-change latch.**

An earlier fix had replaced a set-membership probe (`does a superseding PR exist`) with a per-PR
**state row**: nine cells covering head sha, isDraft, state, mergedAt, closing links, human comments,
reviews, mergeable. Its written rationale was *"a membership probe answers 'does it exist', never
'what is it doing'"* — correct, and it caught a real event.

Then that PR acquired two genuinely failing CI checks and **the fingerprint did not move a byte.**
None of the nine cells is a check-run field. A failing-checks field did exist — for the PR on the
*watched branch* only, and the work had migrated to a different branch.

## The rule

⭐⭐⭐ **Derive latch fields from the DECISIONS the latch feeds, not from "what could this object do
next."** Object-first enumeration yields a plausible list that is silently partial. Decision-first is
closed: enumerate the decisions (dispatch-or-not, report-or-not, cancel-or-not), ask what input each
consumes, then verify **every watched object** supplies it.

⭐⭐⭐ **Then run the same audit on the fix.** "I fixed the field set" is not a state you reach; it is
a claim about one enumeration. Three consecutive fixes went unaudited because the question was only
ever asked of the original structure, never of the widening.

The entailment was already written down: the fix's own comment justified `mergeable`/`isDraft` as
*"a human acting is decision-relevant."* A failing test is decision-relevant for the identical
reason — it is the input to the one dispatch decision the guard makes. The correct field set was
derivable from my own rationale at the moment I wrote it, with no new information.

## Three sub-lessons that each cost something

⭐⭐ **A COUNT is not the field; the NAMES are.** The failing-check count was **2 before and 2 after**
(an infra gate pair replaced by two real test jobs). A count-only cell stays silent through the whole
event. The retroactive control is what proves this: seed the pre-event row with every other cell
identical, confirm it wakes, and note **which cell** fires.

⭐⭐⭐ **A scheduled guard's PROMPT is as much a latch as its script, and a stale fact written as an
instruction does not merely mislead — it FORBIDS the correct action.** The task prompt said *"CI is
infra-by-design — DO NOT DISPATCH … 0 real failures"*, with its escape hatch keyed on a field covering
only one of two PRs. Fixing the script alone would have left the next correct wake reading "0 real
failures, do not dispatch." ⇒ **When a measurement retires a fact, grep the instructions built on it.**

⚠️ **A bail is not a pass — read WHICH guard fired.** A truncation test "passed" from the wrong guard:
the stub's `*per_page=1*` glob prefix-matches `per_page=100`, so the page query returned a bare number
and the array-shape guard fired, never the completeness guard under test. **Same stub bug as the prior
fix, made a second time.**

⭐⭐ **"N jobs skipped" is not a weaker green — it is the ABSENCE of the measurement.** The sibling PR
carried a **byte-identical** copy of the failing test with **zero** matching check-runs, because a
priority gate skipped them. Its tidy-looking red hid the same latent failure for two days. Unmeasured
and clean are one report apart and opposite facts.

⇒ **One census, one implementation.** The prior defect survived because a sibling guard already had the
correct paginated + `rows == total_count` gate while this one did not — same logic, two places, one
wrong. Widening a census to a second call site is the moment to hoist it into one function and
**delete** the inline copy, not to copy it.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786184514952-a-state-row-carries-only-the-fields-you-asked-of-i.md`_
