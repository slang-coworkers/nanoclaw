---
name: feedback_a_latchs_field_set_is_its_blind_spot
description: "A state-change latch only sees the fields you enumerated: 'no wake' means 'none of the things I listed moved', never 'nothing happened'. Found 15:07Z 2026-08-06 on my #12371 guard (issue comment count watched, PR review surface dark). Omission defects are invisible to failure-injection testing — the missing probe never runs; use a RETROACTIVE control (seed only the new cell changed). 6th fix 08-07 names why enumeration kept missing: I enumerated BRANCH-side actions, but a field that is a function of two refs (mergeable) changes when the ref I am not watching moves. Ask of each field: whose action changes this?"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: d2bcb8ee-b636-4f9d-ac9c-90db4296a6c8
---

# A latch's field set is its blind spot

⭐⭐⭐ **A state-change latch is only as good as the field set it covers. When it stays silent, that
means "none of the fields I happened to enumerate moved" — it never means "nothing happened."**

## The instance

Guard `i12371-pr-guard-0175` watched draft PR #12382 (slang#12371). Its fingerprint was
`(head, isDraft, state, mergedAt, sorted failing-check set, ISSUE comment count)` plus a 4-hour
heartbeat floor. Measured 2026-08-06 15:07Z while reading my own latch on a heartbeat wake:

**The PR was on the list of things being watched. Nothing about the PR's review surface was in the
fingerprint.** A reviewer submitting a review, requesting changes, or leaving an inline comment
changed **no field**, so it could sit unseen for the full 4 hours. The PR was a *draft awaiting
exactly that event*: the single most decision-relevant thing that could happen was the one thing the
guard could not see. The issue's comment count was in there — the wrong surface, watched carefully.

Fix: three shape-checked probes (`pulls/N/reviews`, `pulls/N/comments`, `issues/N/comments`, each
excluding our own bot login) appended as `|prrev=N|prrc=N|prc=N`.

## Why testing did not catch it

⚠️ **This is a different defect class from the two latch bugs before it, and the tests that caught
those are structurally blind to it:**

| # | bug | shape | caught by |
|---|---|---|---|
| 1 | fired on a STATE not a CHANGE | no latch at all | two-directional fire test |
| 2 | failure path WROTE the latch | *how* the value is written | `gh`-stub failure injection |
| 3 | **field set too narrow** | ***what is in* the value** | **nothing above** |

⭐⭐⭐ **An omission defect cannot be surfaced by failure injection, because the missing probe never
runs — there is no call site to break.** Every test I had asked *"does the mechanism behave correctly
on the inputs it reads?"* The answer was yes, all five ways, while the input I needed was absent.
⇒ **Audit a latch by asking "what event would I want to wake for?" and checking each against the
field list — a coverage question, answered by enumeration, not by running the thing.**

## 2026-08-07 05:2xZ — the 6th fix, and it names WHY enumeration kept missing

Same guard, four more fixes later (`xprs` membership → `xst=` per-PR state → …). Found by
`grep -c mergeable i12371-pr-guard.sh` ⇒ **0**. The field was absent entirely.

⭐⭐⭐ **The generalization I could not see for five rounds: I had been enumerating fields by asking
"what could the FIXER do next?" — a branch-side question. `mergeable` is a function of TWO refs, so
it changes when the ref I am not watching moves.** Master advancing flips
`MERGEABLE → CONFLICTING` while the PR's head sha, commit count, file set, check-runs and closing
links stay **byte-identical**. No amount of branch-side enumeration reaches it, because the actor is
not the branch.

⇒ **Audit each field by asking *whose action changes this?* Fields owned by a third party — the base
branch, the repo config, the clock — need their own probe.** The five prior fixes all widened the set
along the axis I was already looking down; this one required a different question.

Already half-realized and dark when found: master had moved to `88fa1206` and both PRs were at
**behind 5** with zero fingerprint movement. The next master push touching the same file would have
converted silent behind-ness into a silent conflict — the exact state that blocks the merge the guard
exists to observe.

⭐ **Two design choices worth carrying:** latch the **tri-state** `mergeable`, not
`mergeable_state` — `behind` is a *normal resting value*, so latching it wakes on every master push
repo-wide (noise, not signal). And treat `UNKNOWN` as **unmeasured, bail without touching the latch**,
never as a state: GitHub returns it transiently while recomputing after a push, so latching it wakes
twice per push (→UNKNOWN, →back).

⭐ **The retroactive control is what makes an omission fix credible.** Seed the prior fingerprint with
**only the new cell changed** (`…:CONFLICTING`, every other cell identical) and confirm it wakes. That
distinguishes *"the field is present"* from *"the field catches the event that was dark"* — the
distinction an omission fix is otherwise unable to demonstrate, per the section above.

## Companion rules

⭐⭐ **A test of a budgeted mechanism must not consume the budget it measures.** My verification fires
overwrote the `lastwake` file, which would have shifted the real 4-hour heartbeat cadence off the
genuine 15:00:04Z wake — the next heartbeat would land early and I'd have read *my own test* as PR
activity. Restore any production counter a test touches, and note the restored value.

⭐⭐ **The blind spot is where you were most confident.** I had just written two long derivations about
this exact latch, and both were about write-path integrity. Having thought hard about a mechanism
makes you *less* likely to re-ask the basic coverage question about it — depth on one axis reads as
depth overall. See [[feedback_a_latch_its_own_failure_path_can_write_is_not_a_latch]],
[[feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path]],
[[feedback_a_remedy_that_can_reproduce_its_own_bug]].
