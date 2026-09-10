---
name: waiting-and-queued-are-two-different-blocks-on-one-job-name
description: "A required-reviewers gate yields run/job status='waiting' with a non-empty pending_deployments; a starved self-hosted pool yields 'queued' with runner_name='' and steps=0 — pr-12309 was the second, misreported as the first, and the falcor-bridge pool has ONE runner (11 rows, NOT the n=1 I first published) while two sibling Windows falcor pools have 2-3 — count runners BY LABEL SET; queued splits into busy-vs-absent by handoff timestamps."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 3a9c1658-b084-4fd9-badf-659d94e701b9
---

**2026-08-07, slang.** A peer reported that a new `falcor-ci` **required-reviewers** environment (landed via #11915, merged 12:03:50Z — verified: 3 files, `ci-falcor-test.yml` gains `environment: falcor-ci` at `:18`) had parked merge-queue head-of-line **pr-12309** on human approval for 124 min, and asked me to approve it and to decide a steady-state policy for queue traffic.

⛔ **The gate diagnosis was wrong for that run.** Measured on run `31179974395`:

```
run.status            = queued          ← a gate yields "waiting", never "queued"
pending_deployments   = []              ← an empty gate queue
job test-falcor       = queued, steps=0, runner_name="", labels=[Linux,self-hosted,X64,falcor-bridge]
merge_group runs (100 fetched)          → statuses {completed:97, queued:2, in_progress:1}, waiting: 0
```

⭐⭐⭐ **`waiting` and `queued` are two different blocks that render identically in prose as "stuck".** The discriminator is one field pair:

| block | `run.status` | `pending_deployments` | `runner_name` | `steps` |
|---|---|---|---|---|
| **required-reviewers gate** | `waiting` | **non-empty** (env + reviewers) | `""` | 0 |
| **starved self-hosted pool** | `queued` | `[]` | `""` | 0 |

Both show `runner_name=""` and `steps=0`, so **those two fields cannot separate them** — the separating field is `status` (`waiting` vs `queued`) plus `pending_deployments`.

✅ **The gate is real, just not on the run they cited.** Two *`pull_request`* runs were genuinely `waiting`, each with `pending_deployments=[{environment: falcor-ci, reviewers: [Team ci-approvers]}]`:
- `31187761893` — `add-callshader-support-to-optix`
- `31184917490` — **`fix/issue-10641`**, another coworker's own branch

⇒ ⭐⭐⭐ **The gate applies to `pull_request` and — on the evidence — NOT to what was blocking the merge_group entry.** `ci.yml` does fire on `merge_group: [checks_requested]` and calls the gated workflow with no event exclusion, so a merge_group run *can* hit the environment; but the actual post-gate merge_group falcor jobs measured **`completed/success` (12:03:52Z, 3 steps)** and **`in_progress` (13:37:56Z, 2 steps)**. **Queue falcor work is executing, not gated.**

⛔ **`current_user_can_approve = False` on both gated runs, reviewers = `Team ci-approvers`.** So the request *"only you can clear it"* is false for me: I am not on that team and the API refuses me. **A request to approve should be verified against `current_user_can_approve` before it is escalated to a human as actionable** — otherwise the escalation names the wrong actor.

## ⭐⭐⭐ THE REAL MECHANISM, which neither of us was looking for: the pool has ONE runner

```
falcor jobs with an assigned runner today = 1
DISTINCT runner names                     = 1   ['kernelvm-falcor-bridge']
in-flight simultaneously                  = 3   (pr-12309 queued, optix queued, fix/issue-10641 waiting)
```

⇒ **`falcor-bridge` is a single-runner pool, so falcor work SERIALIZES.** Three demands, one server: whoever is second waits for the first to finish, and that wait is `queued`, indistinguishable in a status column from a policy gate. **A long `queued` on a `self-hosted` label is a capacity question (how many runners serve this label?), not a policy question** — and the count is one query.

⚠️ **The gate still plausibly contributes, indirectly:** a gated `pull_request` run holds no runner while `waiting`, so it does not consume the single bridge — but once approved it will, ahead of or behind queue traffic. **The interaction between a one-deep pool and a human-approval gate is the thing to reason about, and it is invisible if you attribute the delay to either one alone.**

## ⭐⭐ What the peer did right, and it is the part to copy

They **withheld the alarm** after catching their own instrument defect: their first landing-gap read (`per_page=40`) said *"106 min, exceeds median 47"*, but that median was **a single sample** and the read had missed the newest landing. Three pages gave 26 landings ⇒ current gap **69 min = 24th percentile**, 19 of 25 historical gaps larger. ⇒ ⭐⭐⭐ **Truncated pagination can MANUFACTURE an alarm, not only hide one** — the same silent bound I hit twice today, third polarity. A short page biases a *median* as readily as it empties a *list*, and a median-of-one has no error bars at all. **Any threshold claim must carry its N.**

⇒ **Diagnosis and alarm are separable, and they got that ordering right: report the mechanism, withhold the alarm.** My correction is to the mechanism, not to the restraint.

See [[feedback_a_field_named_like_a_state_is_not_a_test_for_that_state]] (`started_at` set on a `queued` job — same endpoint, same trap family) and [[feedback_a_negative_grep_for_someone_elses_wording_is_not_a_negative_for_the_belief]] (the pagination bound, and why a cause you just proved gets over-attributed).

## ⛔ MY "ONE RUNNER" FIGURE WAS n=1 — the exact defect I had credited the peer for catching, two messages earlier

I wrote `falcor jobs with an assigned runner today = 1 → DISTINCT runner names = 1` and called `falcor-bridge` a single-runner pool. **That is a pool size inferred from ONE sample** — structurally identical to the "median 47 from a single sample" I had just praised them for catching. They widened it; the conclusion survived on real evidence, and I re-measured independently at higher N still:

```
my re-measure: 127 ci.yml runs scanned, 86 falcor job rows (08-06T19:00 → 08-07T15:41)
  [Windows,self-hosted,perf]             43 rows → 3 runners  SLANGWIN10X64-1, SLANGWIN4, SLANGWIN5
  [Windows,self-hosted,falcor]           32 rows → 2 runners  SLANGWIN4, SLANGWIN5
  [Linux,self-hosted,X64,falcor-bridge]  11 rows → 1 runner   kernelvm-falcor-bridge   ← ONLY
```

⭐⭐⭐ **`Test (Falcor)` runs under THREE different label sets, so "how many falcor runners are there?" has no single answer** — aggregate across them and you get 4+ distinct names and the bottleneck vanishes; sample only today's one assigned job and you get 1 from n=1. **Same right answer from a wrong-N instrument, which is the least informative kind of agreement.** ⇒ **Group runner counts BY LABEL SET, and report rows-per-group as the N.**

⚠️ **And my first re-measure attempt sampled only 4 rows** because `actions/runs?per_page=100` is dominated by non-CI workflows — the *repo-wide* run list is the wrong corpus for a question about one workflow. `actions/workflows/ci.yml/runs` paged to 127 runs gave 86 rows. **A per_page bump does not fix a wrong-corpus query.**

## ⭐⭐⭐ `queued` HAS TWO SUB-CAUSES THAT ALSO READ IDENTICALLY: a busy pool and an ABSENT pool (peer's, from their own near-miss)

They checked live bridge occupancy, got **empty output**, and were one step from reporting *"the runner is offline, this isn't serialization at all"* — a full refutation built on a too-narrow query (their occupancy loop searched only the 2 repo-wide `in_progress` runs; the bridge job wasn't in that slice). `/actions/runners` is **403** to both of us, so the pool cannot be inspected directly.

✅ **The instrument that works without that permission: consecutive job start/end timestamps on the single runner.**
```
08:55:43 → 09:45:47   50 min
13:31:29 → 14:14:47   43 min   (long idle before — genuine gap)
14:14:49 → 14:58:23   44 min   ( 2 s handoff)
14:58:25 → 15:41:44   43 min   ( 2 s handoff)
15:41:45 → 15:42:13    0 min   ( 1 s handoff)
15:42:14 → running now          ( 1 s handoff)
```
**1–2 second handoffs between 43–50 minute jobs ⇒ SATURATED, not dead.** pr-12309's 176-minute wait ≈ 4 job-lengths of backlog — **arithmetically expected, not anomalous.**

⇒ ⭐⭐⭐ **The actionable quantity is runners × job duration, not runner count.** `1 × 45 min` means every additional demand costs three quarters of an hour, and three simultaneous demands guarantee a >2 h wait **with nothing wrong anywhere**. A capacity diagnosis that stops at "one runner" cannot tell you whether a 176-minute queue is normal; the time constant is what makes it decidable.

⇒ **Full discriminator tree for a stalled-looking job:** `status=waiting` + non-empty `pending_deployments` ⇒ policy gate (find the reviewers, check `current_user_can_approve`). `status=queued` ⇒ capacity — then split *busy* from *absent* by consecutive handoff timestamps on that label set, since `/actions/runners` is 403.

## ⛔⭐⭐⭐ 2026-08-08 — `status=waiting` HAS A SECOND, WORSE CONSEQUENCE: it counts as ACTIVE CI, so one un-approved gate freezes EVERY bot dispatch repo-wide

The tree above correctly routes `waiting` ⇒ *policy gate, find the reviewers*. **That answers "why is THIS run stuck" and completely misses the blast radius.** Measured on shader-slang/slang:

```
run #30098 (id 31179559787)  status=waiting  29.7h   branch fix/issue-12383, nv-slang-bot[bot]
  environment falcor-ci → reviewer team ci-approvers, current_user_can_approve=false
ACTIVE_STATUSES  (extras/ci/ci_priority_common.py:29)
  = {"queued","in_progress","waiting","requested","pending"}      ← "waiting" IS IN THE SET
⇒ wait-for-priority.py yields every bot CI dispatch to it
blast radius: 12 failed bot dispatches / 6 branches
  (fix/issue-12386 ×5, fix/issue-11981 ×2, test/property-accessor-coverage-12231 ×2, 12371, 12367, 12307)
```

⇒ ⭐⭐⭐ **A run parked on a human is waiting for a HUMAN, not consuming runners — but a priority gate that treats `waiting` as "active CI" converts one un-actioned approval into a repo-wide freeze.** ⇒ **When you find a `waiting` run, the next question is never "why is it waiting" alone — it is `grep ACTIVE_STATUSES` to learn who ELSE yields to it.** The per-run diagnosis and the radius are different measurements, and **the radius is the actionable figure, not the age.**

### ⭐⭐⭐ THE DEADLOCK — the escalation clock only ticks on the path the block prevents

Both safety valves exist and both fail on this exact shape:

```
wait-for-priority.py     --max-yield-hours 12   ages from created_at, "fixed across reruns" (:65, ceiling :179)
                         BUT each fresh DISPATCH is a NEW run → age resets to ~0
                         measured on two real dispatches: 0.12h, 0.56h  (vs 12h ceiling)
ci-retry-yielded-bot.yml would rerun the SAME run (so age accumulates)
                         BUT refuses while anything is active: 12 fires in 2h, each
                         "CI is still active (1 run(s)); not rerunning bot CI."
retry-yielded-bot-ci.py  --lookback-hours 16    → #30098 at 29.7h has aged OUT of consideration
```

⇒ ⭐⭐⭐ **The anti-starvation ceiling can only accumulate on the rerun path, and the block disables the rerun path.** A timeout that cannot accumulate is not a timeout. ⇒ ⭐⭐ **Whenever you read a "we escalate after N hours" comment, ask WHICH CLOCK — `created_at` of a rerun ≠ `created_at` of a fresh trigger, and the difference decides whether the guarantee exists at all.**

⭐⭐⭐ **THE ACTION-VS-REASON SPLIT, worth more than the mechanism:** the fixer had already stopped dispatching, calling further dispatches *"noise — neutral but wasteful."* Correct action, wrong reason. **Each dispatch RESETS the only timer that could free the block** ⇒ actively counterproductive. Both readings say "stop" today, and they diverge the instant someone reasons *"the runs are harmless, dispatch once more to be sure."* ⇒ ⭐⭐ **A right action resting on a wrong mechanism is an unexploded failure: record the mechanism, not just the conclusion.**

⚠️ **AND THE ATTRIBUTION ERROR THAT NEARLY STOOD:** the report arrived as *"the livelock affecting my PR"* — accurate about the symptom (`jobs=40, nonskipped=3, failure`, reproduced identically on two SHAs), wrong about the cause. The branch was the **most-affected, not the cause.** ⇒ ⭐⭐⭐ **"X reported the CAUSE" is a claim needing the same independent resolution as a figure** — an observation can be sound while its attribution is inherited from whatever explanation sat nearest. Third distinct source of that shape this week.

✅ **Resume path BUILT, not promised** (the standing rule this would otherwise have violated — [[feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path]]): telling a peer *"I'll tell you when it clears"* is a gate on an external human with no trigger I own. `ncl tasks create --name ci30098-blocker-clear` (`*/20`, script `/workspace/agent/.ci30098_gate.sh`), **armed at BOTH poles before scheduling**: pointed at a completed run → `reason=BLOCKER_CLEARED`; pointed at a bogus id → quiet, **not** a false clear (so a `gh` outage cannot manufacture an all-clear). It also wakes on `ADDITIONAL_BLOCKER` if the waiting-count grows.

### ⛔⭐⭐⭐ STRONGER THAN THE DEADLOCK: `wait_timer=0` means THERE IS NO CLOCK — and I had the datum on screen and missed it

I derived the deadlock above ("the escalation clock only ticks on the path the block prevents") and reported it as *the ceiling cannot accumulate*. A peer then read the same `pending_deployments` payload I had already fetched and drew the conclusion I had not:

```
/actions/runs/31179559787/pending_deployments
  wait_timer: 0        wait_timer_started_at: null
  current_user_can_approve: false      reviewers: [Team ci-approvers]
```

⇒ **`wait_timer=0` on a required-reviewers gate means no elapsed-time path exists AT ANY DURATION.** My framing implied a slow clock; the truth is no clock. ⭐⭐ **"It will age out eventually" was never on the table**, and the two findings compose into the reportable form: *no mechanism in the system can clear this without a human*.

⛔ **THE FAILURE THAT MATTERS IS NOT THE MISSING CONCLUSION — IT IS THAT I FETCHED THE FIELD AND READ PAST IT.** `wait_timer: 0` was in my own tool output roughly an hour before the peer named it. ⇒ ⭐⭐⭐ **A datum you fetched but did not interpret is indistinguishable, in your later reports, from one you never had** — and it is worse than a missing measurement because it *feels* covered. Same shape as [[feedback_a_pending_tell_does_not_catch_the_error_it_was_designed_for]]: possession is not use. ✅ **Guard: when a payload is fetched to answer question A, name what its OTHER fields say before closing — especially any field whose value is `0`/`null`/empty, which reads as "nothing here" when it is often the whole answer.**

### ⚠️ AND THE RADIUS FIGURE ITSELF SPLIT — a recency window UNDER-counted a live blast radius

The peer reported *"all 5 known yields are branch `fix/issue-12386`* ⇒ one fix looping, not five problems." I measured 12 yields / 6 branches. Resolved by checking the `wait-for-human-priority` job **individually per run** rather than inferring from `conclusion`:

```
fix/issue-12386 ×5 · fix/issue-11981 ×2 · test/property-accessor-coverage-12231 ×2
fix/issue-12367 ×1 · fix/issue-12371 ×1 · fix/issue-12307 ×1        (all 12: gate job = failure)
```

Their three newest ids were all `12386` — **the branch that dispatches most often dominates a recent window**, and the other five branches' yields (oldest `31181848925`, 08-07) fell outside it. ⇒ ⭐⭐⭐ **Third instance in one day of recency-ordering silently defining a population — and the FIRST that produced an UNDER-count of a live problem rather than a false all-clear.** The consequence was a wrong next-action: *"watch for a second branch to appear"* was already satisfied five times over, so that trigger could never fire on new information. ⇒ ⭐⭐ **A trigger specified against a windowed baseline is pre-satisfied and therefore dead** — check whether your watch condition is already true at the moment you set it.
