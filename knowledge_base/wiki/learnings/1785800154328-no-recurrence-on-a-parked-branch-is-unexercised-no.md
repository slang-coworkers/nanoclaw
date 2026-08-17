---
title: "'No recurrence' on a parked branch is unexercised, not fixed — and check a closing rationale against the timeline"
type: learning
topic: ci-tooling
source: learnings/1785800154328-no-recurrence-on-a-parked-branch-is-unexercised-no.md
---

# "No recurrence" on a parked branch is unexercised, not fixed — and check a closing rationale against the timeline

Two mistakes to avoid when a CI-hazard issue gets closed with an explanation, learned re-verifying slangpy#1070 (GPU `Unit Tests (Python)` wedging to the 360-min job cap).

**1. Absence of recurrence proves nothing if the trigger was never re-run.** 07-29 → 08-03: 46 `ci` runs across 14 branches, zero wedges, Python-step median 1.70 min / max 7.00 min, longest job anywhere 17.5 min. Looks cleared. But the signature had **only ever** fired on one branch (`dev/slangpy-fixer/1051` — 6 of the 7 long-job runs in 07-01→07-13), that branch hadn't run CI since 07-13, and its trigger file never landed on `main`. So the clean window is "the trigger is parked," not "the hazard is gone." Before reporting a hazard as cleared, ask: *was the thing that reproduced it actually exercised in the clean window?* If not, say "unexercised" and name the measurement that would settle it.

**2. Check the closing rationale against the commit timeline.** slangpy#1070 was closed as "the race condition in profiling". Two verifiable facts don't fit:
- The profiler feature (`src/sgl/utils/profiler.cpp`, "Profiler (#1063)" `dac9e0e3`) merged 2026-07-13T17:02Z — **after** 5 of the 6 wedges (07-12T17:03 → 07-13T14:33). Check with `gh api "repos/O/R/contents/<path>?ref=<sha>"` per wedged sha; a 404 means the code wasn't there, so it can't be the cause.
- The merged mitigation (#1076) added `* doctest::skip()` to two **C++** `TEST_CASE`s only — it cannot mechanically change a *Python* test step. The claimed real fix (#1073) was still open and `mergeable_state: blocked`.

A maintainer's diagnosis is strong evidence about the system, but it isn't automatically a statement about *your* failure instances. Cross-check it against dates and diff scope before you build a plan on it — and raise the mismatch as a question rather than a contradiction.

**Attribution mechanics for these wedge hunts:**
- `updatedAt - createdAt` from run listings is unreliable for re-runs. Use `run_started_at` plus per-**job** `started_at`/`completed_at`.
- Read per-**step** conclusions, not just the job's. The #1070 signature is: `Unit Tests (C++)` **completes** (~1 min), then `Unit Tests (Python)` runs 174–352 min and is `cancelled`. A wedge on `Unit Tests (C++)` (e.g. run 29460256843) is a **different** hazard — don't merge the two.
- A wedge produces no assertion output, so the step name plus duration *is* the whole signal.

Structural gap that makes these expensive and is still open on slangpy `main`: `Unit Tests (Python)` has no `timeout-minutes` in `ci.yml`, and `tools/ci.py:156,164` runs `-n auto --maxprocesses=4` (the cap→2 mitigation, PR #1024, was closed unmerged). Any recurrence burns 6h with zero attribution.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785800154328-no-recurrence-on-a-parked-branch-is-unexercised-no.md`_
