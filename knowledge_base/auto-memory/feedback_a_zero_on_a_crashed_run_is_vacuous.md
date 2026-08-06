---
name: feedback_a_zero_on_a_crashed_run_is_vacuous
description: "A zero exonerates a cause only if the run REACHED the subject. LIVENESS controls ('did I read anything?') pass on a crashed run; you need a COVERAGE control — count your claim's own noun here vs a known-good run (measured 1-vs-220)."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: e403d63e-625c-48cf-8f0b-f84463a4b98a
---

# A zero measured on a run that never reached the subject is vacuous — and it defeats the obvious control

**2026-08-06, slang#12096. My error, caught by slang-triager.** I published, to a peer and into a
memory file, that the 08-03 red nightly (`shader-slang/slang` run `30780633558`, macOS job
`91584414600`) was "unrelated to #12096 — the failures were `docs/generated/tests/design/**`
IR-reference tests." Two independent defects in one sentence:

1. **Wrong cause.** Measured on that job's log: `ir-reference` = **0**, `docs/generated` = **2** (both
   *shell comments in the workflow script*), `FAILED test:` = **0**. The `docs/generated` failure list
   I quoted came from a **different log I had open in the same shell** — the 08-05 *green* run
   (`cov-macos.log`, 13 such entries, 671 `ir-reference` hits). I read one file's tail and attributed
   it to another. Actual cause: `Segmentation fault: 11` in `slang-test` at `run-coverage.sh:306`, on
   **both** the initial run and the retry ⇒ `Process completed with exit code 139` = **#12320**.

2. ⭐⭐⭐ **The defect that matters: my exonerating evidence was VACUOUS, not merely mis-labelled.**
   I cited `required_threads_per_threadgroup` = 0 as proof the metal4 mechanism wasn't at play. But
   `gfx-unit-test-tool` appears **once** in that entire log — the harness segfaulted *before ever
   running the four Metal tests*. **A cause cannot be ruled out on a run where its subject never
   executed.** My conclusion ("unrelated") was right by luck; the reasoning was empty, and it would
   have been just as confident had #12096 been actively regressing.

## ⭐⭐⭐ The generalization: LIVENESS control vs COVERAGE control (triager's framing, 08-06 — better than mine)

My original framing ("prove the subject ran") named the fix but not the reason the standard control
misses. The sharp version:

| control asks | example | passes when |
|---|---|---|
| **liveness** — did my instrument read anything? | `passed test:` = **8,737** | ✅ always, on any log with content |
| **coverage** — did the run REACH the thing whose absence I'm citing? | `gfx-unit-test-tool` = **1** | ❌ fires here |

**A crashed, truncated, timed-out, or early-exiting run passes liveness and fails coverage — and
liveness is the one everybody runs.** That is the whole defect in one line.

**Cheap general form:** take the noun from your own claim, count it in the run under test **and** in a
known-good run. The ratio is the discriminator. Measured on this chain (all three reproduced
independently on my edge):

| run | `gfx-unit-test-tool` | `Metal.internal` | the metal4 zero is |
|---|---|---|---|
| 08-03 red | **1** — and it's a *link* line (`[1389/1445] Linking CXX shared module …libgfx-unit-test-tool.dylib`) | 0 | **vacuous** |
| 08-04 green | 220 | 14 | meaningful |
| 08-05 green | 220 | 14 | meaningful |

⭐ **220-vs-1 was available before either of us published.** No new tool, no new access — one `grep -c`
against a known-good run.

⚠️ **And the sole hit was a BUILD artifact, not a test line.** So even a nonzero count needs a glance at
*what matched*: a target that merely **links** looks present to any bare `grep -c`. Print the line.

## Why the reflexive control does not save you

I *did* have a working instrument, and that is the trap. The natural control — *"is the harness alive?
did any test run at all?"* — **PASSES loudly**: `passed test:` = **8,737** in that same log. The run
executed thousands of tests, then crashed partway through, before reaching the subset in question.

⇒ **An alive-harness control proves the harness ran. It says nothing about whether the harness reached
YOUR target.** This is a distinct sub-case of B2 in
[[feedback_two_absence_failures_one_evades_controls]]: there the target *set* was wrong; here the
target set was right and the **run terminated before covering it**. Neither a bound test (B1) nor a
positive control on the log detects it.

**The control that would have fired is a per-subject presence check, not a global one:**
`grep -c 'gfx-unit-test-tool' <log>` → **1**. One line where a full run has hundreds is the tell.

## The trap in the opposite direction (triager's, worth keeping)

**A crashed harness emits ZERO `FAILED test:` entries.** So on a red job, "no failure entries" reads
exactly like "nothing failed." Both of us met this from different sides — I read the zero as innocence
for my mechanism; anyone else would read it as innocence for the whole suite.

⇒ ⭐⭐ **Establish a CI verdict from the step conclusion / exit code first; per-test entries are the
LAST place to look, not the first.** `exit 139` is unambiguous where a per-test sweep is silent.

## The checks

1. ⭐⭐⭐ **Before citing a zero as exoneration, prove the subject RAN.** One presence count on the
   subject's own token (`gfx-unit-test-tool`, the test name, the backend label). A zero-because-absent
   and a zero-because-passed are the same integer.
2. ⭐⭐ **On a red run, read the exit code before the test lines.** Segfault / OOM / timeout ⇒ the log is
   *truncated by the crash*, and every downstream count is a lower bound, not a measurement.
3. ⭐ **One log per shell, or name the file in every claim.** Two logs open in `/tmp` is all it took to
   graft one run's failures onto another's id. Same root as the absolute-paths rule: a bare filename is
   not a referent when several candidates are in scope.
4. ⭐⭐ **State which control you ran AND what it cannot see.** "Harness alive" ≠ "target covered"; say
   which one you have.

5. ⭐⭐ **A grep miss is not an absent claim** (triager, verifying its own patch): one post-patch probe
   read **0** on text that was demonstrably present — the needle contained the `*before*` italic
   markers. When a verification probe returns zero, suspect the needle before concluding the content is
   gone; **print the sentence** rather than trusting the count. Same family as check 3 — a bare count is
   not a reading.

## ⚠️ Audit the CONCLUSION and its SUPPORT separately — "right by luck" was my own overcorrection

I wrote that my "unrelated" verdict was *right by luck*. The triager pushed back and is right: the
conclusion was right for a **verifiable** reason — the segfault at `run-coverage.sh:306` on *both*
attempts, `exit 139`, matching **#12320**, whose body carries all three signatures. **The luck was in
the SUPPORT I happened to cite, not in the conclusion.**

⇒ ⭐⭐ **Grading a claim needs two independent verdicts: is the conclusion sound, and is the stated
support sound?** Collapsing them costs you in both directions — accept a wrong claim because the
reasoning looked tidy, or (here) disown a sound claim because its support was junk. **Auditing them
separately is exactly what surfaced this defect**, and over-flagellating the conclusion would have
thrown away a correct finding.

**Meta:** the conclusion survived and the reasoning did not — the most dangerous shape, because nobody
re-audits evidence sitting under a conclusion they already accept
([[project_10842_metal_descriptorhandle_runtime]]'s provenance lesson, and
[[feedback_matching_incumbent_path_is_not_validation]]). The triager replaced my basis with a stronger
one *while agreeing with my verdict* — that is what a good correction looks like, and it is exactly the
case I would have been tempted to wave through.

Related: [[feedback_green_job_skipped_backend_zero_coverage]] (a green job proves compilation, not
execution — the same gap, mirrored), [[feedback_zero_test_jobs_is_not_zero_tests_ran]],
[[feedback_a_negative_control_must_vary_exactly_one_thing]],
[[feedback_a_guard_can_be_inert_and_read_as_passing]].
