---
name: a-sentinel-pinned-to-an-instance-fires-forever-once-that-instance-dies
description: "A watcher whose clear-condition is 'run X left status=waiting' becomes PERMANENTLY true the moment X reaches any terminal state — so it fires 'cleared' on every fire, and it fired while a DIFFERENT run had re-formed the identical block 24 min earlier. Watch the PROPERTY (zero ci.yml runs waiting), never an instance of it. Also: cancelled-by-concurrency is not approved."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: af84b095-ea2b-4477-8116-2042d2fd45aa
---

**2026-08-09, slang, my own sentinel.** On 08-08 I built `.ci30098_gate.sh` to give an operator-gated
wait its own resume trigger (correct instinct — see
[[feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path]]). I armed it two ways before
scheduling: pointed at a completed run it fired `BLOCKER_CLEARED`; pointed at a bogus id it stayed
quiet. Both controls passed. **Both controls were of the instrument, not of the condition.**

⛔ **THE DEFECT: the clear condition was monotone in the wrong direction.**

```bash
RUN_ID=31179559787          # run #30098
if [ "$status" != "waiting" ]; then  →  BLOCKER_CLEARED
```

A run's status is `waiting` at most once and terminal forever after. So `status != waiting` is not an
event — it is an **absorbing state**. Once #30098 died the script was structurally incapable of ever
saying anything else. ⭐⭐⭐ **A sentinel on a monotone predicate does not "fire once"; it fires on
every fire until something cancels it.** My own positive control — *"pointed at a completed run it
fired BLOCKER_CLEARED"* — **was a demonstration of exactly this bug that I read as proof of arming.**

⭐⭐⭐ **AND IT WAS WRONG ON THE FACTS AT THE MOMENT IT FIRED.** Measured 01:22–01:37Z:

| what | measurement |
|---|---|
| #30098 approved? | **No.** `/actions/runs/31179559787/approvals` → `[]` |
| how it ended | `conclusion=cancelled` 00:59:24Z, after 36.4h `waiting` |
| why | ci.yml `concurrency: ${{ github.workflow }}-${{ github.ref }}`, `cancel-in-progress` on non-push. A new bot `workflow_dispatch` **#30170** on the *same branch* created 00:59:22Z → same group → killed the parked run 2 s later |
| its deployment | 5805649902: `waiting` → **`error`** 00:59:25Z (an approved one reads `waiting → queued → in_progress → success`) |
| the block now | **#30154** (`31258367401`, fix/issue-11981, attempt 3) reached test-falcor 01:23:05Z, deployment 5814389468, `status=waiting`, reviewers `[ci-approvers]`, `current_user_can_approve=false` |

⇒ the sentinel reported the wait was over 24 minutes before the wait re-formed on a different run,
and would have authorized a dispatch into a still-blocked repo. ⭐⭐ **`cancelled` is not `approved`
— read the deployment status chain (`error` vs `success`), not just the run conclusion.**

✅ **THE FIX IS A CHANGE OF SUBJECT, not a better probe.** The thing being waited on was never a run;
it was *"no `ci.yml` run is parked on a human approval"*. `.ci_falcor_gate.sh` watches
`/actions/workflows/ci.yml/runs?status=waiting` (server-side predicate — see
[[project_slang_ci_zombie_runs_inert_not_gate_blockers]] for why client-side windowing lies) and
emits `REPO_QUIET` on count 0, `BLOCKER_CHANGED` when the waiting-id **set** changes, silence
otherwise. State is the sorted id set, not a status.

⇒ ⭐⭐⭐ **Before arming any watcher, ask: is my condition a PROPERTY of the world, or a PROPERTY OF
ONE OBJECT that happens to hold it today?** If the object can die while the world stays unchanged,
the sentinel is pinned to the wrong thing. The tell is cheap: **can my clear-condition ever go back
to false?** If not, it is an absorbing state and will fire forever.

⚠️ **Control design, generalized.** My two controls answered *"does the script read GitHub and emit
JSON?"* The controls that would have caught this: (A) run it against **live** state and require
`wakeAgent=false` while the block is known to exist — a steady-state control; (B) poison the stored
state and require a *change* event; (C) break `gh` and require **not-a-clear** (a broken instrument
must not license work — [[feedback_control_the_instrument_not_the_reasoning]]). All three now pass on
the replacement, plus a stub returning an empty waiting set → `REPO_QUIET`.

**Mechanism corrections worth keeping** (the old prompt asserted the opposite; both re-measured):

- **Anti-starvation DOES reach its ceiling.** #30154 aged 12.0h from its fixed `created_at`; its
  00:57:24Z gate printed *"Waited 12.0h (>= 12.0h ceiling); escalating priority and proceeding"*.
- **But escalation rotates the blocker rather than clearing it.** The escalated run proceeds to
  test-falcor and parks on `falcor-ci` itself. So the standing condition is a **rotation** across
  runs, not one stuck run — which is precisely why an instance-pinned watcher cannot track it.
  `ci-retry-yielded-bot` meanwhile refused to act on 30 consecutive fires (13:17Z→00:59Z), every one
  printing *"CI is still active"*; the attempt-3 rerun came from an `nv-slang-bot[bot]` token, not
  that workflow.
- A fresh dispatch is still counterproductive: `classify_blockers` files the older bot run under
  `older_bot`, so the new run yields to it *and* resets its own age to ~0.

Related: [[feedback_waiting_and_queued_are_two_different_blocks]] (the `waiting` vs `queued`
discriminator this all rests on), [[feedback_a_spent_one_shot_stays_pending_and_invites_a_rerun]]
(same family: a repair keyed on a shape a *successful* run also leaves).
