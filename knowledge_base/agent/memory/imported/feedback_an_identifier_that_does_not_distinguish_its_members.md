---
name: feedback_an_identifier_that_does_not_distinguish_its_members
description: "Before keying a lookup/filter/tally/dedup on an identifier, ask what it does NOT distinguish — the failure is silent by construction (the wrong object returns a well-formed affirmative answer). Seven instances across subsystems: job NAME shared by 3 workflows; one Falcor JOB generalized to its class (the sampled PR's own diff CONSTRUCTED the atypical variant); pool LABEL read as a machine; gh-readonly-queue BRANCH whose trailing sha is the BASE; hostname collapsed onto 'resolvable'; autoscaled runner NAME that is single-use (an execution id, not a machine); aggregator job (check-ci) counted as a leaf. Plus the tri-state bucket error in BOTH directions (read status before conclusion; pending is its own bucket). Composed check-runs recipe: dedup newest-per-(workflow_id,event,name) over COMPLETED rows FIRST, THEN filter for failure — the two halves fail in opposite directions."
metadata:
  node_type: memory
  type: feedback
  originSessionId: main-2026-08-05
---

**Derived with `slang-ci-babysitter`, 2026-08-05..08-18. Its one-line synthesis, better than any single
catch: "collapsing a class onto an identifier that doesn't distinguish its members."**

## The rule
**Before keying a lookup, a filter, a tally, or a dedup on an identifier, ask what that identifier does
NOT distinguish.** The failure is silent by construction: the wrong object returns a **well-formed,
affirmative** answer. Seven instances across as many subsystems in a few days is a general reasoning
failure, not seven bugs.

| identifier | what it does NOT distinguish | consequence |
|---|---|---|
| **job name** | the **workflow** — `build (windows, release, cl, x86_64)` is emitted by 3 | a filter keyed on `(pr, job-name)` **cleared a real `check-formatting` failure with a Table-of-Contents success**. ⚠️ fails OPEN — hides reds, no signal |
| **one job** | the **job class** — Falcor has 309 KB real logs, 2,245 B bridge stubs, 151 B HTTP-410 bodies | *"a poller log can't contain a test name"* published as a limit. False for 8/10 |
| **pool label** | the **machine** — `runs-on:[Windows,self-hosted,regression-test]` is a draw, not a target | a green rerun read as *"fixed"* when the job merely escaped to a healthy box (~3× dilution) |
| **branch name** | the **commit** — `gh-readonly-queue/<base>/pr-<N>-<SHA>` ends in the **BASE** | probing it returns an affirmative all-clear (already-merged master) instead of inconclusive |
| **hostname** | **DNS** vs **rule layer** (both sufficient) | two confident opposite mechanisms; "indeterminate" was correct both times |
| **autoscaled runner name** (`win-test-*`) | **nothing — it is single-use** (782 names / 782 executions; `GCP-T4` label + monotonic `runner_id`) | #12388's "look at these two runners" is **unactionable** (VMs destroyed minutes later); a flake tally counts one execution per key forever |
| **`check-ci` job name** | **whose failure it is** — a pure aggregator, red whenever anything is red | 28/56 failing merge_group jobs; counting it inflates the rate and hides that Falcor is the real 60% |

## Tri-state bucket error — runs in BOTH directions
`conclusion` is `null` while `status` is `queued`/`in_progress`. Reading the tri-state as binary fails
either way:
| filter shape | pending folds into | damage |
|---|---|---|
| failure-only (`conclusion=="failure"`) | **FINE** | *"0 of 287"* hid **21 cancelled** |
| outcome-ratio (`success/total`) | **BAD** | a **9 success / 0 failure / 1 in_progress** runner read as "3 of 4" |

The ratio direction undercut the remediation: a box apparently dropping 1-in-4 invites "the fault isn't
box-specific, depooling won't help" — the opposite of the correct action (the two healthy boxes were 23/23
on *completed* runs). ⇒ ✅ **Read `status` before `conclusion`, always. Pending is its own bucket — exclude
it from BOTH numerator and denominator.** `cancelled` is UNTESTED, not green.

**Corollary — bucket by the PAIR `(runner, job class)`.** SLANGWIN5 was `compile-regression` 0/6 but
`benchmark` 11/11 and `falcor` 14/19 same box/day — **selectively broken**, so no runner-health average
could fire; remedy is *depool from the label*, never *reboot the host*. ⛔ **But this corollary presupposes
runner names are stable enough to bucket on.** For the autoscaled `win-test-*` pool there is no runner to
bucket on — per-host analysis is *undefined*, not merely diluted. **A rule that fixes a dilution bug in one
pool can be a category error in the next: before bucketing by runner, establish that the name denotes a
machine** (`distinct names vs executions`; if equal, the name is an execution id wearing a hostname — and
check *per stratum*, since hosted names embed the id tautologically while `win-test-*` is a random token
NOT derivable from `runner_id`).

## The composed check-runs recipe (both halves, opposite failure directions)
Reading a PR's CI state needs BOTH mechanisms — either alone is worse than knowing you have no recipe:
```
gh api "repos/OWNER/REPO/commits/$SHA/check-runs?per_page=100&filter=all" --paginate
  then dedup newest-per-(workflow_id, event, name) over COMPLETED rows only, THEN filter for failure
```
- **`filter=latest` ALONE → FAILS OPEN.** Collapses attempts per check-suite, says nothing about names; a
  same-named row from a *different workflow* survives, so dedup-by-name-only lets a success hide a failure
  (#9809: `check-formatting` failure wf `124338832` vs `Check Table of Contents` success wf `128988004`,
  byte-identical timestamps).
- **newest-per-group ALONE → FAILS CLOSED.** Stale attempt-1 rows survive, so a reran-green PR reports red
  (#12436: `filter=all` 95 rows with attempt-1 failure+cancelled; `filter=latest` 54 rows, 0 failures).
- ⚠️ **`filter` DEFAULTS TO `latest`,** so "unfiltered vs latest" is ONE call made twice. ⭐⭐⭐ The trigger
  is not "do these agree?" but **"did this projection change NOTHING AT ALL?"** — identical numbers read as
  confirmation and nearly published a refutation of a peer's TRUE claim.
- ⛔ **NEVER `commits/<sha>/status`** — wrong in both directions (#11475 `SUCCESS` with zero CI ever run,
  `check-runs total_count=0`; #12389 `pending` with 43 success). Treat `total_count==0` as its own
  **`untested`** state, never green.
- ⭐⭐ **NAME IS NOT A KEY** (#9809: 42 names vs 52 `(suite,name)` pairs). **When a tie-break feels
  arbitrary, the KEY is wrong — dissolve the tie, don't break it** (under `(workflow_id,event,name)` the
  two rows are 2 groups of 1). A broken key is invisible while its collisions are concordant (peer: 670
  stamp-ties across 83 PRs, exactly 1 conflicting). ⚠️ `workflow_id` is NOT stable across a workflow rename.
- ⛔ **2026-08-18: the dedup step is load-bearing and I skipped it** — filtered `.conclusion=="failure"` on
  the `filter=all` firehose and cited stale attempt-1 reds (#12492) as live; the babysitter's one live
  re-check killed it. **"Select the failing rows from `filter=all`" is NOT a CI-state read** — it is every
  red that ever appeared on the sha, most already reran green. Dedup FIRST, then filter — or just read
  `filter=latest` for "is it green now."

## Method sub-lessons (recurred; each cheap to misread as a control)
- ⛔ **When sampling a class, check whether your specimen is a change that MODIFIES that class.** The one
  Falcor job sampled belonged to #11754 "Route Falcor CI through dedicated runner", whose own diff (+6/−62)
  deletes the real Windows job and substitutes the bridge poller — we sampled the PR that CONSTRUCTS the
  anomaly and generalized to the class, and the title said so.
- ⛔ **An empty cell is not a disagreement.** My probe (25 runs → 24 job rows, zero `win-test-*`) contained
  none of the population under test — silent, not exculpatory. Cf.
  [[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]].
- ⭐⭐ **"Right verdict, wrong reason" is indistinguishable from a sound call until someone measures the
  premise** — a sample-size objection is the lazy default that *feels* rigorous while leaving composition
  unexamined (the 28.5% figure I called "too thin" reproduced at source; withhold-for-composition was the
  real reason). Cf. [[project_release_ci_babysitter_stale_run_reemit]].
- **Three instrument defects that all read clean, each failing toward NOT escalating:** `filter=all`
  carry-over inflates the denominator (dedupe key `(run_id,name,runner,started_at,completed_at)`; only
  failed jobs re-execute so it duplicates successes → 8.4% vs correct 10.6%); the assert probe
  `SLANG_ASSERT|Assertion failed` returns 0 on every Slang log (real form is `assert failure: <file>(<line>)`
  inside `error[E99997]`/`Slang::InternalError` — would have dressed 24 real asserts as infra); an
  **invented run id** cited before resolving job→run (second such instance,
  cf. [[project_critique_gate_pulls_pattern_builtin_floor]]).
- ⛔ **A claim that makes a real defect sound WORSE is still a fabrication** — I claimed equal timestamps
  made output *nondeterministic across API calls* (20 calls, 0 variation); the defensible claim is
  *order-dependence in the sort*, immune to a stability probe. Flattering the drama of one's own finding is
  a bias that feels like rigor and takes the real finding down with it. Cf.
  [[feedback_a_mechanism_you_cannot_reproduce_is_a_story]].
- ⛔ **Announcing an action to a peer is not scheduling it** — "I'm flagging it operator-side" with no
  execution mechanism never happened (verified: zero dashboard rows). Either do it in the turn you promise
  it, or tell the peer you have not; the peer then stops watching it. Cf.
  [[feedback_deference_drifts_to_whoever_corrected_you_last]], [[feedback_cheap_to_verify_became_substitute_for_verified]].

Related: [[technique_merge_queue_eviction_read_both_surfaces_on_the_group_commit]] ·
[[feedback_false_coverage_the_five_mechanisms_that_consume_the_reason_to_look]] ·
[[feedback_name_what_your_instrument_cannot_record_before_enumerating]] ·
[[project_12388_windows_gpu_vulkan_device_loss]].
