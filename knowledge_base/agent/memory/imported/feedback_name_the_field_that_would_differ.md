---
type: feedback
name: feedback_name_the_field_that_would_differ
description: "The discriminator for any status artifact (test result, build exit, grep count, CI conclusion, retry-workflow conclusion): name the thing that must have happened, then name the field that would DIFFER if it hadn't — ask which field would CHANGE, not which looks healthy (e.g. run_attempt, not conclusion). Before instrumenting anything, ask: would the outcome change if this mechanism were absent?"
metadata:
  node_type: memory
  type: feedback
  title: "Name the field that would DIFFER, not the one that looks healthy"
---

*Split WHOLE from [[feedback_mechanism_must_predict_observed_coordinates.md]] (folded 2026-09-18 by /okf-synthesis); the source section was marked ⛔ DO NOT COMPRESS, so it is preserved verbatim here.*

## ⛔ DO NOT COMPRESS — the DISCRIMINATOR this rule was missing (2026-08-03)
This file long carried *"all legs verified ≠ explains THIS instance"* as a caution
with no test attached. slang-fixer supplied the test; both halves below are
mine-verified in source.

⚠️ **CORRECTION (fixer's, accepted, and it lands harder on me): this was NOT a missing
discriminator — it was a missing DOMAIN.** The rule already existed in both our stores as
*"name the defect, then name the assertion that fails when only that defect is reintroduced"*,
with **skipped test · stale binary · vacuous assertion · inert `CHECK-NOT`** listed as its
disguises. The fixer applied it deliberately an hour earlier (neutered `isEmptyTypeToLegalize`'s
array branch, rebuilt, proved the `Array<Void>` test non-vacuous) — then read a CI rollup with no
such check. **A CI `conclusion` is an assertion; nobody had classed it as one.**
⭐ **A rule that fires on four disguises and not the fifth is a missing DOMAIN, not a missing
formulation — and filing it as the latter leaves the actual hole open.** Domain is now: *any status
artifact* (test result, build exit, grep count, CI conclusion, retry-workflow conclusion).
⚠️ **My own instance is worse than the fixer's:** my store held this rule **with** the
both-directions refinement (*"would this build have failed if my patch were absent?"*,
*"would this grep have returned 0 if the bug were fixed?"* — and *"the negative-only control was
the one that lied"*), buried in `project_10918_debug_global_variable_rework` and
`project_11917_pass_gating_epic`, **with no index entry at all.** So it was unreachable by my own
retrieval path — [[feedback_narrowing_is_not_testing_check_own_store]]'s unexecutable-store failure,
third instance today. **The deliverable is the INDEX ENTRY, not the rule.**

⭐⭐ **THE DISCRIMINATOR — name the thing that must have happened, then name the field
that would DIFFER if it hadn't. Ask which field would *change*, not which one looks
healthy.**

Worked instance: `ci-retry-yielded-bot` ran 3× after a yield, each concluding
**`success`** — which looks like three retries and is **fully consistent with zero.**
The field that isn't consistent is **`run_attempt`**, still `1`. A conclusion is a
summary; `run_attempt` is the thing that must have changed.

⭐ **PRE-INSTRUMENTATION GUARD: before instrumenting/monitoring anything, ask —
*would the outcome change if this mechanism were absent?*** Concrete cost of skipping
it: a monitor armed on a path that had stopped deciding anything.

### The two mirrored ways to be wrong, same wrong question
| | mechanism | verified? | defect |
|---|---|---|---|
| fixer | draft filtering | yes — it *does* cause the 74 skips | **present but not CAUSAL** (didn't cause the red) |
| me | priority-gate starvation | yes — real, and the 16h/`10:58Z` clock computed correctly | **causal but not ON THE PATH** (stops deciding at the ready-flip) |

Neither could see it from the other's side. Both verified every leg; both asked the
wrong question. **Two agents can hold complementary halves of one blind spot.**

### And the miniature recursion (fixer's own catch, credited)
Its "the flip retires the clock" conclusion was **one leg short**: it had confirmed only
that the gate can't throttle a `ready_for_review` run (`ci.yml:97-99`, `IS_THROTTLED_BOT`
false ⇒ *"Not a throttled bot run; proceeding without yielding"* ⇒ exit 0). Missing leg,
which I checked: the **draft filter** at **`ci.yml:15` and `:681`**
(`github.event_name != 'pull_request' || github.event.pull_request.draft != true`).
Both flip together on `ready_for_review` (`ci.yml:9` types list), so jobs stop skipping
**and** the gate can't throttle. Without that second leg the flip would have traded a
yield for an **empty green run** — the same trap, one level down, inside the correction
to it.
