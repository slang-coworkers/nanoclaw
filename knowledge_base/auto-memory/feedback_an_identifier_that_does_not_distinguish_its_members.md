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

Related: [[technique_merge_queue_eviction_read_both_surfaces_on_the_group_commit]] ·
[[feedback_false_coverage_the_five_mechanisms_that_consume_the_reason_to_look]] ·
[[feedback_name_what_your_instrument_cannot_record_before_enumerating]]
