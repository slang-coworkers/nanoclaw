---
name: feedback_an_aged_run_does_not_escalate_a_rerun_does
description: "A time-based escape hatch (age >= ceiling) fires only inside a RE-EVALUATION, so whatever triggers the re-evaluation is the real dependency — and here that trigger was disabled by the very blocker the hatch existed to escape. Also: a positive control run BEFORE the blocking condition existed says nothing about the blocked state."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 39f7fc21-343c-488e-867c-3f95892ab4b4
---

# An aged-out run does not escalate; a RERUN escalates it — so the rerunner is the real dependency

Measured 2026-08-08 on `shader-slang/slang` CI while guarding [[project_12371_spirv_prelink_validation_buffer]].

## What I published, and why it was wrong

At 13:0xZ I told the operator: *"It is a **12-hour tax, not a permanent block** … #12382's measurement
is ~12 h out (~00:54Z 08-09)."* Evidence: `wait-for-priority.py` has
`--max-yield-hours 12`, computes age from `created_at`, and I had a real positive control — run
**30105** logged *"Waited 12.0h (>= 12.0h ceiling); escalating priority and proceeding"* and then
produced 31 measured build/test jobs, conclusion `success`.

Every leg of that was true. The conclusion was still false.

## The mechanism I skipped

The gate is **single-shot**. `grep -cE 'time\.sleep|while True' wait-for-priority.py` ⇒ **0**, and the
gate job on the run in question ran **12:54:25→12:54:35Z — 10 seconds**. It evaluates its own age
*once*, at the start of the run, and exits.

⇒ ⭐⭐⭐ **A run does not escalate by getting older. It escalates only when something RERUNS it, so the
gate re-evaluates at a larger age.** The ceiling is a property of a *re-evaluation*, not of a clock.

The only thing that reruns it is `retry-yielded-bot-ci.py`, whose **first action** is:

```python
active_runs = any_active_ci(fetch_active_runs(args.repo, args.workflow))
if active_runs:
    print(f"CI is still active ({len(active_runs)} run(s)); not rerunning bot CI.")
    return 0
```

…and `ACTIVE_STATUSES = {"queued","in_progress","waiting","requested","pending"}` (`ci_priority_common.py:29`).

**The blocker was a run with `status=waiting`** (parked 33 h on a human-approval environment). So the
rerunner that would deliver the escalation **was disabled by the exact run whose blockage it exists to
escape.** Deadlock, not a tax.

✅ **Measured rather than argued:** I classified all **44** rerunner fires since the blocker appeared by
their own decision line — **43** `"CI is still active (1 run(s))"` naming that run, **1**
`"Rerunning yielded bot CI run #<blocker>"` (the fire that *created* the waiting state), **0** others.
0-for-44 on everything, not just my branch.

⛔ And the window **closes** rather than opens: `--lookback-hours 16` skips candidates whose
`created_at < now-16h`, so my run stopped being a rerun candidate **4 h after** the earliest moment it
could have escalated. A "wait for it" framing had the sign backwards.

## The reading error, stated as a rule

⭐⭐⭐ **I read a control's SUCCESS without reading its PRECONDITION.** The escalation control's rerun
started **01:23:59Z**; the blocker did not enter `waiting` until **04:27:41Z**. The hatch was observed
working in the one window where the blocker was **absent**, and I generalized it to a window where the
blocker is present *and is itself what disables the hatch*.

⭐⭐ **A positive control taken BEFORE the blocking condition existed is evidence about the mechanism's
happy path, never about the blocked state.** Worse: I *wrote* the correct hedge —
*"evidence about the mechanism, not about this branch"* — and then drew the un-hedged conclusion in the
next sentence. **Writing the hedge is not the same as obeying it**; see
[[feedback_a_hedge_costs_the_entailments_of_the_decided_claim]] for the converse failure.

## Guards

1. **For any "it will resolve itself in N hours" claim, name the PROCESS that re-evaluates at hour N**,
   and check that process's own preconditions. If the answer is "the clock", the claim is probably
   wrong — clocks don't run code.
2. **When a retry/repair mechanism is load-bearing, read its first guard clause.** A bail-early
   condition on "is the system busy" makes the mechanism useless in exactly the busy state you need it.
   Same shape as [[feedback_a_spent_one_shot_stays_pending_and_invites_a_rerun]]: the repair path's
   trigger, not its body, is where the defect lives.
3. **Timestamp the control against the blocker.** Before citing a prior success as proof a path works
   *now*, compare its start time to when the current blocker began. One `created_at` comparison.
4. **A cheap census beats a mechanism argument.** Classifying 44 log lines by their decision string
   settled this in one loop; no amount of reading the scripts would have told me it was 0-for-44.

## Why the retraction had to ship

The corrected framing implies a **different action**: not "wait ~12 h" but "a human must approve the
environment on run X, or the measurement never happens." The fingerprint had not moved and the chain
looked settled — irrelevant. Per the carve-out in [[feedback_audit_credit_as_hard_as_blame]], **a
correction to a figure already in someone's hands ships regardless of who declared the thread closed.**
