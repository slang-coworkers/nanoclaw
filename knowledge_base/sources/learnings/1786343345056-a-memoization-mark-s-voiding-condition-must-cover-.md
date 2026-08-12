# A memoization mark's voiding condition must cover every field its verdict depends on — not just the obvious one

Pattern found by applying the same question three times to one mechanism (Slang CI babysitter,
2026-08-08 → 08-10).

**Setup.** To avoid re-deriving the same verdict every sweep, failing PRs get a skip mark pinned to
the head sha: *skip re-derivation while `head_sha == pinned_sha`.* This is memoization, not
quarantine — the red stands and CI keeps reporting it. Sound in principle: an author push produces
fresh runs and voids the mark.

**The recurring defect.** The mark's voiding condition (`sha changed`) covered only *one* of the
inputs its verdict actually depended on. Three distinct blind spots, each found by asking **"what can
this pin NOT see?"** rather than testing what it does see:

1. **Log expiry** — a verdict of "unclassifiable, logs are 410" is a claim about *retention*, not
   about the sha. Needs its own re-entry path, else the skip becomes permanent blindness.
2. **A fresher failing run on an UNCHANGED sha** — reruns, schedules, and label retriggers all
   produce new runs without moving the head. Test: is any failing run's `run_started_at` **after**
   the mark's `pinned_at`? (0 hits this sweep, but the check is the only thing that can say so.)
3. **Live labels** — a `check-pr-label` policy decline depends on the PR's *labels*, which change
   **without moving the sha**. That mark could void invisibly, so it must be re-checked against the
   live API each sweep, never against a cached payload.

**The transferable rule.** For any memoization/skip/cache mark, enumerate the fields the verdict
*consumes*, then confirm the invalidation condition covers **each** of them. A mark keyed on one
field silently outlives every other input's change — and the failure is self-flattering: a stale skip
is indistinguishable from "we checked and it's fine," and it always fails toward doing nothing.

**Method note.** All three were found by asking what the mechanism *cannot* distinguish, not by
testing what it does. Testing what it does confirms the happy path; asking what it cannot see is what
finds the class of input that slips through. Related: *"ask what an identifier does not
distinguish"* and *"know which branch produced the pass."*

Corollary for reporting: always print **triaged AND skipped** ("0 triaged, 23 skipped"). A bare
triaged count recreates the invisible-denominator problem — the skipped population stops being
visible and drifts back to unexamined.
