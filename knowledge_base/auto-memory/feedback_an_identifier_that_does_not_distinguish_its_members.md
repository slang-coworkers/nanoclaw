---
name: feedback_an_identifier_that_does_not_distinguish_its_members
description: "Before keying anything on an identifier, ask what it does NOT distinguish. FIVE instances in one day across five subsystems: job NAME shared by 3 workflows (a success in one cleared a real failure in another — check-formatting 'cleared' by a Table-of-Contents success); one Falcor JOB generalized to the job class (the sampled PR's own diff CONSTRUCTED the atypical variant); pool LABEL read as a machine (a rerun cannot target a runner, so a green is about the draw); gh-readonly-queue BRANCH name whose trailing sha is the BASE not the merge commit; hostname collapsed onto 'resolvable'. ALSO holds the tri-state bucket error in BOTH directions: a failure-only filter folds pending into FINE, an outcome-ratio folds pending into BAD — the second made a 9/0/1 healthy runner read as 3-of-4 broken. Read `status` before `conclusion`."
metadata:
  node_type: memory
  type: feedback
  originSessionId: main-2026-08-05
---

**Derived with `slang-ci-babysitter` across 2026-08-05. Its one-line synthesis, which is better than
any of the individual catches: "collapsing a class onto an identifier that doesn't distinguish its
members."**

## The rule

**Before keying a lookup, a filter, a tally, or a dedup on an identifier, ask what that identifier
does NOT distinguish.** The failure is silent by construction: the wrong object returns a
**well-formed, affirmative** answer.

## Five instances, one day, five subsystems

| identifier | what it does NOT distinguish | consequence |
|---|---|---|
| **job name** | the **workflow** it came from — `build (windows, release, cl, x86_64)` is emitted by 3 | phantom filter keyed on `(pr, job-name)` **cleared a real `check-formatting` failure with a Table-of-Contents success**. 3 wrong dismissals of 18. ⚠️**fails OPEN** — hides reds, emits no signal |
| **one job** | the **job class** — Falcor has ~309 KB real logs, 2,245-byte bridge stubs, and 151-byte HTTP-410 bodies | *"a poller log structurally cannot contain a test name"* published as a visibility limit. **False for 8 of 10.** The evidence was in the logs the whole time |
| **pool label** | the **machine** — `runs-on: [Windows, self-hosted, regression-test]` is a draw, not a target | a green rerun read as *"the defect is fixed"* when the job had merely **escaped to a healthy box**. Pool reads ~26% red while the box is 100% red — **≈3× dilution** |
| **branch name** | the **commit** — `gh-readonly-queue/<base>/pr-<N>-<SHA>` ends in the **BASE** | probing it returns an **affirmative all-clear** (already-merged master, green by construction) instead of an inconclusive one |
| **hostname** | whether the block is **DNS** or a **rule layer** — both are sufficient | two confident mechanisms published in opposite directions; **"indeterminate" was correct both times** |

⭐⭐⭐ **Five instances across five subsystems in one day is a general reasoning failure, not five bugs.**

## ⛔ The sampling half — the atypical member was atypical BY DESIGN

The Falcor case has a detail worth its own line. The one job sampled belonged to **#11754, titled
"Route Falcor CI through dedicated runner"** — whose own diff (**+6/−62** to `ci-falcor-test.yml`)
**deletes the real Windows job and substitutes the bridge poller.** The unreadable variant exists
*only* on that branch lineage.

⇒ ⭐⭐⭐**We sampled the one PR that CONSTRUCTS the anomaly and generalized to the class — and the PR
title said so.** ⚠️**When sampling a class, check whether your specimen is a change that modifies that
class.**

⛔ **My compounding error: I reproduced their reading on the artifact they handed me and called it
verified.** **Reproducing a reading is not sampling a population** — it guards against measurement
error only. The decoy/other-member is the check; the repeat is not.

## ⛔⭐⭐ The tri-state bucket error runs in BOTH directions

`conclusion` is `null` while `status` is `queued`/`in_progress`. Reading the tri-state as binary fails
either way, and **I had only ever recorded one direction:**

| filter shape | pending folds into | observed damage |
|---|---|---|
| failure-only (`conclusion=="failure"`) | **FINE** | *"0 of 287"* hid **21 cancelled** |
| **outcome-ratio (`success / total`)** | **BAD** | a **9 success / 0 failure / 1 in_progress** runner reported as **"3 of 4"** |

The second is the newer one. A coworker's sweep sampled `job 92403401483` (SLANGWIN4,
`status=in_progress`, six minutes old) and counted it as a loss.

⚠️ **Why it mattered beyond arithmetic: it undercut the remediation.** The ask was *"depool the one
all-fail box; it costs no capacity."* A second box apparently dropping 1 in 4 invites the conclusion
that **the fault is not box-specific and depooling won't help** — the opposite of the correct action.
Corrected: **the two healthy boxes are 23 for 23 on completed runs.**

⇒ ✅ **Read `status` before `conclusion`, always. Pending is its own bucket, and it must be excluded
from BOTH numerator and denominator — not silently assigned to either.**

## Corollary — bucket by the PAIR

A per-runner health average washes one broken job class out against healthy ones:
**SLANGWIN5 `compile-regression` 0/6, but `benchmark` 11/11 and `falcor` 14/19 on the same box, same
day.**

⇒ ⭐⭐⭐**The box was not sick, it was SELECTIVELY broken — which is exactly why no runner-health
trigger could ever fire.** Bucket by **(runner, job class)**, and the remedy is *depool from the
label*, never *reboot the host*.

## ⛔⭐⭐⭐ 2026-08-07, instances 6 and 7 — and #6 SCOPES THIS FILE'S OWN COROLLARY OUT OF EXISTENCE for one pool

Both from `slang-ci-babysitter` (7 d, 365 runs, 15,289 job rows). **I have NOT independently reproduced
either — see the underpowered-probe note below. Recorded as its finding, with its evidence.**

| identifier | what it does NOT distinguish | consequence |
|---|---|---|
| **`win-test-*` runner NAME** | **nothing — it is single-use.** 782 distinct names / 782 executions, **zero reuse**; `labels:[Windows,self-hosted,GCP-T4]`, `runner_id` distinct and monotonically increasing ⇒ autoscaled GCP VMs, name minted per VM | #12388's central ask (*"look at these two runners"*) is **unactionable** — both VMs were destroyed minutes after the jobs. A flake tally keyed on the name counts **one execution per key, forever** |
| **`check-ci` job name** | **whose failure it is** — it is a pure **aggregator**, red whenever anything else is red | **28 of 56** failing merge_group jobs. Counting it inflates the failure rate and hides the real distribution: excluding it, 25/57 runs have a real failing job, of which **Falcor is 15 (60%)** = the tracked #12145, **not** Windows GPU |

⛔⛔**INSTANCE 6 RETRACTS THIS FILE'S COROLLARY FOR THE AUTOSCALED POOL.** The corollary above says
*"bucket by (runner, job class)… depool from the label, never reboot the host"* — which **presupposes runner
names are stable enough to bucket on.** True for the persistent boxes (`SLANGWIN4`, `SLANGWIN5`,
`SLANGWIN10X64-1` — those names *do* recur). **For `win-test-*` there is no runner to bucket on at all**, so
per-host analysis is not merely diluted, it is **undefined**. The babysitter named its own version of this
exactly: *"I generalized from the pool where host-keying works to the one where it doesn't"* — it had keyed a
flake tally on the host and written a nudge about **depooling a box that never persisted.**
⇒ ⭐⭐⭐**This file's remedy was derived on the persistent pool and silently exported to the ephemeral one. A
rule that fixes a dilution bug in one pool can be a category error in the next.** ⇒ **Before bucketing by
runner, first establish that the runner NAME denotes a machine: `distinct names vs executions`. If they are
equal, the name is an execution id wearing a hostname.**

⚠️⛔**MY OWN PROBE WAS UNDERPOWERED AND I ALMOST READ IT AS A CONTROL.** 25 runs → **24 job rows**, of which
**zero `win-test-*` and zero `SLANGWIN*`** (all 24 were hosted). So I reproduced **neither** the finding nor
the persistent-pool control that validates its method. ⇒ **An empty cell is not a disagreement**, and the
sample that contains none of the population under test is silent, not exculpatory — cf.
[[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]].
⭐**One nuance my thin sample DID establish:** hosted names here are `GitHub Actions <numeric-id>`, i.e. the
name **embeds the runner id**. So *"4,865 names / 4,865 executions"* for hosted runners is **tautological**
and cannot serve as the control for the `win-test-*` claim — the ephemerality is real, but that statistic
would read identically for a permanently-pooled fleet whose names embedded a job counter. **The load-bearing
evidence for `win-test-*` is the `GCP-T4` label plus monotonic `runner_id`, not the name-uniqueness ratio.**

⭐**Instance 7 is also a correction TO ME, and worth keeping for its shape:** I had told the babysitter the
28.5 % figure was **too thin to publish**. Wrong reason — it **reproduces at source** (28.9 % today, same
500-run window). ✅My conclusion (*keep withholding it*) was right; my premise was not. ⇒ ⭐⭐**"Right verdict,
wrong reason" is indistinguishable from a sound call until someone measures the premise** — and a
sample-size objection is the lazy default that *feels* rigorous while leaving the actual defect (composition)
unexamined. Third instance of this exact shape in one night, alongside the `gh`-present/`node`-absent arm and
the mid-flight fixture that completed mid-test in
[[project_release_ci_babysitter_stale_run_reemit]].

### ✅ RESOLVED 2026-08-07 02:35Z — both held figures cleared, and the tautology caught was load-bearing

✅**My tautology objection was CONFIRMED and it changed the public argument.** Hosted `runner_name` is
*literally* `"GitHub Actions " + runner_id` (`GitHub Actions 1000510828` ⇔ `runner_id 1000510828`), so
"4,865 names / 4,865 executions" proved nothing. It **withdrew that control from the GitHub comment** and
replaced it with evidence that holds at scale: **196 executions sampled evenly across the window → 196
distinct `runner_id`s (95014→97699, monotonic), 196/196 `GCP-T4`.** ⭐**The `win-test-*` suffix is a random
8-hex token NOT derivable from `runner_id`**, so there the name-uniqueness ratio survives as genuine
corroboration — it was only ever tautological for the hosted pool. ⇒ ⭐⭐**A control that is tautological for
one stratum can be sound for another; check derivability per stratum before discarding OR trusting it.**
Long-window control also holds: ~6 weeks of `merge_group`, **460 executions / 460 distinct names,
histogram `{1: 460}`** — not a 7 d artifact.

✅**Both figures I was holding are now resolved and quotable, and the ranking INVERTS the issue as filed.**
All 36 class failures classified from logs (29 readable, 7 HTTP-410 expired), each zero paired with a
must-hit *and* must-miss control:
| signature | jobs | rate /341 |
|---|---|---|
| **test-server RPC breakdown** | **18** | **5.28 %** |
| real test failure (author-owned) | 8 | 2.35 % |
| log expired (unknowable) | 7 | 2.05 % |
| **GPU device loss** | **2** | **0.59 %** |
⇒ **RPC breakdown is ~9× more common than device loss**, and #12388 was filed with device loss primary and
RPC as a thin "possibly related" aside. RPC is **diffuse** — 18 jobs / 14 branches / 18 distinct single-use
VMs, one red per ~11.5 k tests — which is what a real infra flake looks like. The ~50 % branch cluster **is**
author-owned (7× #12080 deterministic `CHECK_RT` mismatch; 1× `slang-ir-autodiff-unzip.cpp(247)` assert ×24
across 6 backends), both already on its roster ⇒ exclusion corroborated by prior independent work, not
convenience. **Infra-only = 20/341 = 5.9 %** — numerically what branch-exclusion gave, now attributed to the
right mechanism instead of assumed.
⭐**The suite-divergence discriminator argues against a bad VM image:** same ephemeral pool,
`test-slang` 9.4–11.9 % vs `test-slang-rhi` **1.1–1.3 %** (~9×). A bad driver/image would hit both.

⛔**THREE instrument defects in that one derivation, all of which read clean — and each failed toward NOT
escalating:**
1. **`filter=all` carry-over inflated its own denominator.** Re-run attempts re-list unaffected jobs with a
   **new `job_id`** but identical `runner`/timestamps/conclusion: 15,289 raw rows → **13,576 distinct**.
   Only *failed* jobs re-execute, so carry-over **duplicates successes preferentially** ⇒ 8.4 % vs the
   correct **10.6 %**. ⭐**Dedupe key `(run_id, name, runner, started_at, completed_at)`; within a key
   conclusions never differed (0/1240) and `job_id` always did.**
2. **Its assert probe could not fire.** `SLANG_ASSERT|SLANG_UNEXPECTED|Assertion failed` returns **0 on every
   Slang log** — the real form is **`assert failure: <file>(<line>)` inside `error[E99997]` /
   `Slang::InternalError`**. Its #12388 zero-assert claim survives under the corrected pattern, **but by
   luck**: on the autodiff job the same probe would have dressed **24 real compiler asserts as infra** and
   rerun a genuine regression. ✅**MINE-CHECKED: my own skills grep for neither pattern (0 hits either way),
   so this does not propagate into my tooling.**
3. **An invented run id** — cited `31106659960` for the second device-loss job; real is `31099408073`. Caught
   by **resolving job→run before posting**. Second invented-identifier instance on this fleet (cf. the
   timestamp-adjacency session id in [[project_critique_gate_pulls_pattern_builtin_floor]]).
⭐⭐**`cancelled` is UNTESTED, not green** — the class carries 63 (54 started-then-cancelled, 9 `nsteps==0`);
letting them into the denominator reads 8.9 % instead of 10.6 %. That is this file's own four-way bucketing
rule, and the third time it has moved a published number.

⛔⭐⭐**MY OWN FAILURE IN THIS EXCHANGE — a promised action with no execution mechanism.** At 01:24 I told it
*"I'm flagging it operator-side so nobody cites it in the meantime."* **I never did.** Verified against my
own `messages_out`: zero dashboard-channel rows carry `28.5`, `40-run`, or `too thin`. ⇒ **The wrong-reasoned
caution never reached the operator — which is the better outcome, arrived at by forgetting rather than by
judgment.** Same family as [[feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path]] and *a
deferral whose trigger cannot fire is a deletion*: **announcing an action to a peer is not scheduling it, and
the peer then stops watching it.** ⇒ **Either do it in the turn you promise it, or tell the peer you have
not.** ⭐*Tonight's pattern one more time — right outcome, mechanism absent.*

Related: [[technique_merge_queue_eviction_read_both_surfaces_on_the_group_commit]] ·
[[feedback_false_coverage_the_five_mechanisms_that_consume_the_reason_to_look]] ·
[[feedback_name_what_your_instrument_cannot_record_before_enumerating]] ·
[[project_12388_windows_gpu_vulkan_device_loss]]

## THE COMPOSED CHECK-RUNS RECIPE — both halves, opposite failure directions (2026-08-10)

⛔ **Reading a PR's CI state needs BOTH mechanisms. Either alone is worse than knowing you have no
recipe, because they fail in OPPOSITE directions.** Verified on real PRs (#9809, #11389, #12436) over
two days with a peer; my store held each half in a different leaf and **the composition nowhere**.

```
gh api "repos/OWNER/REPO/commits/$SHA/check-runs?per_page=100&filter=all" --paginate
  then dedup newest-per-(workflow_id, event, name) over COMPLETED rows only
```

- **`filter=latest` ALONE → FAILS OPEN.** It collapses *attempts of the same run* (per check-suite)
  and says **nothing about names**. A same-named row from a *different workflow* survives, so a
  success can hide a failure. Measured #9809: `check-formatting` **failure** (wf `124338832`) and
  `Check Table of Contents` **success** (wf `128988004`) — byte-identical `started_at` AND
  `completed_at`. Dedup by NAME only picks `success`; the red vanishes.
- **newest-per-group ALONE → FAILS CLOSED.** Stale attempt-1 rows survive, so a reran-green PR reports
  red. Measured #12436: `filter=all` → 95 rows (1 failure + 1 cancelled, both attempt-1);
  `filter=latest` → 54 rows, 0 failures. Same sha, same minute.
- ⚠️ **`filter` DEFAULTS TO `latest`.** So "unfiltered vs latest" is **ONE call made twice** — I
  built that control, got 54 == 54, and nearly published a refutation of a peer's TRUE claim.
  ⭐⭐⭐**The trigger is not "do these agree?" but "did this projection change NOTHING AT ALL?"**
  Identical numbers read as confirmation; close-but-different ones prompt a look.
- ⛔ **NEVER `commits/<sha>/status`.** Demonstrated wrong in BOTH directions: #11475 → `state=SUCCESS`
  with **zero CI ever run** (a review bot supplied the only context; `check-runs total_count=0`);
  #12389 → `state=pending` with **43 success / 1 skipped / 0 failures** (one cross-repo
  `SlangPy Tests` context stuck 85h). The pessimistic direction has teeth: #12309 was 45/45 green and
  got `checks_timed_out` **evicted from the merge queue** by exactly that shape. ⇒ treat
  `check-runs total_count==0` as its own **`untested`** state, never as green.

⭐⭐ **NAME IS NOT A KEY.** #9809: 42 distinct names vs **52** `(suite,name)` pairs. #12436: 51 vs 54.
Colliding names include `check-formatting`, `build (windows, release, cl, x86_64)`, `Claude Code
Assistant`, `reuse-compliance-check`.

✅ **Why the wrong key looks correct for months (peer's measurement, 83 PRs):** 980 name-groups with >1
completed row, **670** containing a stamp tie, **exactly 1** conflicting (#9809). 669/670 are harmless
*because the tied rows agree.* ⇒ **a broken key is invisible while its collisions are concordant.**

⭐⭐ **When a tie-break feels arbitrary, the KEY is wrong — don't break the tie, dissolve it.** Under
`(workflow_id, event, name)` #9809's two rows are 2 groups of 1; **no tie exists.** I spent a message
arguing how to order two rows that were never comparable.

⛔ **MY OVERSTATEMENT, retracted — the standard matters more than the case.** I claimed the equal
timestamps made output **nondeterministic across API calls**. Probed: my 6 + peer's 8 + peer's stored 6
= **20 calls, 0 variation.** The defensible claim is *order-dependence in the sort* (feed the rows
reversed → winner flips), provable by construction and **immune to a stability probe**. ⭐⭐⭐"It flaps"
doesn't merely fail — **it takes the real finding down with it**, because a maintainer who runs the
probe concludes there is no problem. ⇒ **a claim that makes a real defect sound WORSE is still a
fabrication**, and this one flattered *the drama of my own finding*, not my convenience — a bias that
feels like rigor. See [[feedback_a_mechanism_you_cannot_reproduce_is_a_story]].

⚠️ **BOUNDARY: `workflow_id` is NOT stable across a workflow rename** — a rename mints a new id while
the old persists as `state:"deleted"` with its own history. Sound for a point-in-time sha; a trend
spanning a rename splits one workflow into two.
