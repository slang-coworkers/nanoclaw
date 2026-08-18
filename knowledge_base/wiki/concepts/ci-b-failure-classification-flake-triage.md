---
title: "Classifying CI failures: flake vs. real, job-scoped defects, never-scheduled jobs, and the controls that actually discriminate"
type: concept
group: ci
tags: [ci, flake-triage, gha, runners, controls, merge-queue, aggregator-checks]
source_count: 9
---

## TL;DR

- **Group by log SIGNATURE, never by job name** — job identity ≠ failure identity. And **identify aggregator/rollup checks first** (`check-ci`, `Sanitizer Summary`) and exclude them from signature counting: an aggregator fails *because a sibling failed*, so grouping by it guarantees a false unified story.
- **Bucket CI outcomes by the PAIR (runner, job class), never by runner alone.** A job-scoped runner defect (bad toolchain on one box for one job class) is invisible to any per-runner health check because the box passes every other job class.
- **Never-scheduled ≠ failed.** `run.conclusion=failure` + `job.conclusion=cancelled` + empty `steps[]` + empty `runner_name` = a job that never got a runner. Rerun it; do not read logs or fix code. `failedSteps: []` on a failing job means job/infra-level failure, not a test assertion.
- **The available control is not the valid control.** Name the two hypotheses you're separating (ours vs. pre-existing), then pick the observation that *differs between them*. The cheapest decisive control is often a **sibling run at the same SHA** (many workflows fire on both `push` and `pull_request`) — same tree can't pass and fail on a content defect, but a scheduling failure can.
- **A rerun is evidence only if the step under test actually ran.** Enumerate the outcomes the *instrument* can produce, not just the world — the "failed again without ever running" cell is where wrong conclusions live.
- **Base rate decides urgency and frequently inverts it.** A one-day slice can't distinguish new-and-urgent from chronically-bad. Rank by distinct signature and distinct PR, not record count.
- **Never call CI "blocked" from a snapshot counter.** Measure the windowed rate AND check `required_status_checks.contexts` — a non-required check can't gate no matter how red. Cheapest confirmation: did commits land on master while it was red?
- **A narrow detector reports its own coverage as the world's state.** Trigger on any terminal non-success; branch to specialised discriminators *inside* the handler.
- **Key everything on the JOB's `started_at`,** and use `attempts/<n>/jobs` — run-level `created_at`/`.conclusion` describe attempt 1 only and silently drop reruns.

---

## Signatures, aggregators, and the nest-check

The method that turned "8 gating merge-queue failures" into a correct classification on slang uses four lenses, each of which caught a real error: [Classifying a batch of CI failures: aggregator checks, signature-not-job-name, and the nest-check](../learnings/1786005268785-classifying-a-batch-of-ci-failures-aggregator-chec.md)

1. **Identify aggregator checks and exclude them.** `check-ci` fails because a sibling job failed — a rollup, not a cause. Reporting "8 `check-ci` failures" as one problem *guarantees* a false unified story, since every distinct cause presents identically through the aggregator. Find the aggregator first, then attribute to the sibling that actually failed. (An aggregator reporting "results missing" when results *are* genuinely missing is working correctly — root-cause the upstream, don't add it to a false-positive list.) [GHA: run-level failure + job cancelled + empty steps[] + no runner = NEVER SCHEDULED, which is not FAILED](../learnings/1786033059224-gha-run-level-failure-job-cancelled-empty-steps-no.md)
2. **Group by log signature, not job name.** Grouping by name gave "Falcor ×2, Windows-GPU ×2." Per-occurrence logs gave Falcor ×4, `test-compile-regression` ×2 (missed entirely), and two Windows-GPU singletons that were *not each other* (1 failed test vs 111, on different runners). A 100× difference in failed-test count inside one job family is two problems. Record `runner_name` per failing job — it collapsed the compile-regression pair to a single bad machine immediately.
3. **The nest-check — do co-occurring timelines nest inside your confirmed cause?** Cheap and decisive at two scales: *across causes* (the `CI` failures started ~11h before the first submodule-check failure, so they can't be downstream of it) and *within one set* (four signatures fell in sequential bands rather than interleaving, justifying the split). If a failure starts earlier than your root cause, it's a different problem. **A confirmed diagnosis is the most likely thing to absorb unrelated evidence.**
4. **Base rate decides urgency, and it frequently inverts it.** Window n=115 `CI` merge_group runs: 42.3% failure baseline; the "spike" day was 58% — inside a range that ran 25–50% routinely ⇒ chronically noisy queue, pre-existing and tolerated, not a step change. Denominator discipline: 31 distinct PRs saw ≥1 eviction but 10 were evicted 2–3× and 3 of 8 in-window failures were the *same* PR on three SHAs (author iteration). **Rank by distinct signature and distinct PR, never record count.**

Eviction-vs-flake stated honestly: all 8 were `attempt=1` with no same-sha green retry available ⇒ **none was provable flake** (the strict test needs a green retry at an *unchanged* head sha). That 4 of 6 PRs later merged without a code fix is *suggestive* of environmental causes, not proof — when a read-only seat can't trigger the rerun, label the environmental read a hypothesis and say what would confirm it. A downstream symptom (`slang-test left generated files in the worktree`) is a consequence of the aborted run, not a shared cause.

## Tests are STEPS inside build jobs — resolve a test claim at the log line, not the job list

Verifying a "test passed on device X" claim in slangpy cost four instrument errors in one session, each a cheaper proxy returning a confident wrong answer. **Tests run as a *step* inside each build job** (`Typing Checks (Python)` → `Unit Tests (C++)` → `Unit Tests (Python)`), so a job-name scan (`.jobs[].name` returns 12 `build (...)`, zero `test`) structurally cannot see them — check `jobs/<job_id> --jq '.steps[]'`. Piling true adjacent facts onto a wrong-granularity probe (`ci-gcp` has zero runs; `slangpy_torch` last failed months ago — both true, both irrelevant since GPU tests ride in `ci`) disguises it instead of repairing it. Three further lies a scan tells: half the matrix never runs the tests (6 of 12 build jobs have `Unit Tests (Python)` = `skipped`, so "the run is green" ≠ "the test ran" — check per job `.steps[]|select(.name=="Unit Tests (Python)")|.conclusion`); the `[NOTSET]` collapse (a cuda-only-parametrized test renders `test_foo[NOTSET]` with no CUDA device, so an audit keyed on `[DeviceType.*]` finds *nothing there* — PASSED and SKIPPED indistinguishable); and your regex is an instrument needing a control (`test_[a-z_]+\[DeviceType\.` silently drops seed-parametrized ids, undercounting 44→4; use `test_file\.py::[^ ]*`, and dedupe pytest `-v`'s double-printed lines to a `PASSED|FAILED|SKIPPED` verdict count). **Make the disconfirming check as concrete as the claim it's killing — if the claim names a test, resolve it at the log line naming that test, never at the job list.** A *correction* is the worst possible place for an unverified claim, because its form asserts the checking already happened. [CI evidence in this repo: tests are STEPS inside build jobs, and three ways a scan lies about them](../learnings/1785961540178-ci-evidence-in-this-repo-tests-are-steps-inside-bu.md)

## Job-scoped runner defects are invisible to box-health checks

Slang's `test-compile-regression` draws from a 3-member self-hosted pool. Over a whole day, keyed on **job `started_at`**: SLANGWIN5 was 0/6, the healthy boxes 16/16. But the same box the same day was test-benchmark 11/11 and test-falcor 14/5 — it is not sick, it is *selectively* broken (its SPIR-V validator scored `[ 0 / 866 ]` while compilation was green, exit 255 — a broken validator binary on that box, not bad compiler output). [A job-scoped runner defect is invisible to box-health checks — bucket per (runner, job class), not per runner](../learnings/1785962011577-a-job-scoped-runner-defect-is-invisible-to-box-hea.md)

Because the box passes every other job class, any per-runner success-rate trigger reads it as healthy and never fires. **Bucket by the PAIR (runner, job class).** The mirror argument is the stronger diagnostic: to prove a defect is job-scoped rather than a sick host, show the box succeeding on *other* job classes in the same window — that turns "flaky runner" into a precise depool/repair ask. A pool label (`runs-on: [Windows, self-hosted, regression-test]`) is not a machine: with 1 of 3 defective, a rerun is a ~2/3-odds lottery — a cheap probabilistic workaround, but re-landing on the bad box is common. Ratios come from `success + failure` only (`cancelled` jobs are UNTESTED — folding them into either bucket biases the result). Quote **evictions** to a maintainer, not reruns — a rerun can't restore a lost merge-queue position.

## Never-scheduled is a distinct state that scores as failure

Triaging four CI-failure webhooks on slang #12155 surfaced a GHA state that scores identically to a real failure under the obvious predicate but demands the opposite response:

```
run.conclusion  = "failure"     ← the webhook payload
job.conclusion  = "cancelled"
job.steps       = []            ← empty, not "some failed"
job.runner_name = ""            ← never assigned
started_at → completed_at ≈ 15 min   ← queue timeout, no execution
```

Empty `steps[]` + empty `runner_name` = nothing executed = a scheduling miss. Rerun; don't read logs, don't fix code. Use `attempts/<n>/jobs` not `runs/<id>/jobs`. The trap: **the same two jobs can go red for two unrelated reasons within an hour, and the second gets read by memory of the first.** On this PR, head A had a genuine priority-yield (retry workflow owns it, do nothing); head B ~45 min later had `filter` never-scheduled → `check-ci` failed with a real runner because it `needs:` all 25+ jobs and every one skipped — an infra miss whose retry workflow *does not cover it* (that workflow targets yielded runs; nothing was recorded as yielded). Diagnosing the second from the first means waiting indefinitely for a retry that never comes. **Re-derive the cause every time; a repeat symptom is not a repeat cause.** Prefer a *mechanism* argument over a *correlation* argument for "mine or ambient" (what the check does — a license-header check, my delta touched no SPDX line — beats ambient window-sensitive correlation). Scope reruns to *gating* checks; a `pull_request_target` board-sync failing alongside yours is churn attributed to you. [A CI-failure signature changes between ticks — reclassify from the failed JOBS, never from your stored verdict](../learnings/1786021291273-a-ci-failure-signature-changes-between-ticks-recla.md)

## Choosing a control that discriminates

A Falcor image test failed on a PR under review (`test_GBufferRTTexGrads_d3d12`, exit `0xC0000005`). Three agents proposed four different controls; all four were real measurements and **none could discriminate** — each was closer to hand than to the question (release-sibling timing, rasterization siblings passing, job-succeeds-on-other-heads, job-level failure history). The discriminating control: does this **specific test** fail on an **independent branch**? It did — same crash code, unrelated branch, same day ⇒ pre-existing and intermittent. A green re-run would have been *weaker* evidence than the cross-branch reproduction. [The available control is not the valid control — four controls on one CI failure, none discriminating](../learnings/1785970095748-the-available-control-is-not-the-valid-control-fou.md)

How to choose: **name the two hypotheses, then ask what observation differs between them.** Every rejected control was compatible with *both* hypotheses — which is exactly why each felt like evidence while providing none. Three traps around control selection:

1. **The favourable-direction gap** — nobody goes looking for the observation that would settle it when the one already in hand points the expected way (one agent ruled out only the *unfavourable* reading; the mirror error is looking only for greens).
2. **Near-identical artifact names** — an agent nearly concluded "infra" after opening the wrong job (`…889` was "Falcor **Perf**", passed; the red was `…957`). Check each job's `conclusion` before opening any log.
3. **A reconciliation is not a resolution** — when counts disagreed (7 vs 12), "different scopes, both valid" was too generous: one scope included control-group tests and double-counted a test running in two suites (`sort -u` deduped rows, not tests). Check whether one scope is *invalid* for the claim before splitting the difference.

## The free control: a sibling run at the same SHA

Many workflows fire on both `push` and `pull_request`, so one commit gets two independent runs — a control sitting in the same API response the whole time: [Look for a sibling run at the SAME commit before reasoning about a CI failure's cause — and a rerun only informs if the step under test actually ran](../learnings/1786041527710-look-for-a-sibling-run-at-the-same-commit-before-r.md)

```
31121727201  pull_request  SUCCESS  runner 1000509863   (real steps, check ran)
31121725027  push          failure  runner ""   steps: []   ← never scheduled
```

Same commit, same file set, opposite outcomes, three seconds apart. **A content defect cannot pass and fail simultaneously on one tree; a scheduling failure can.** No cross-branch comparison or diff reading required.

```bash
gh api "repos/O/R/actions/workflows/<wf>.yml/runs?per_page=30" \
  --jq '[.workflow_runs[]|select(.head_sha=="<sha>")|{event,conclusion,id}]'
```

But **verify the passing sibling actually executed the check** — `conclusion: success` can be vacuous (skipped jobs, filtered paths); a green with `steps: []` is the same never-scheduled state. And the more important half: **a rerun is evidence about a defect only if the step under test actually ran.** The prior mistake was reasoning "a real defect fails identically on rerun; a transient one passes — so rerunning discriminates," then reading four failing reruns as a reproduced bug — when across all four the step under test never executed once (`Set up job` was the only step that ran). The two-outcome test had no cell for "fails again without running." **When designing a discriminating test, enumerate the outcomes the *instrument* can produce, not just the world's** — that third "didn't measure" cell is where the wrong conclusion lives. Retract superseded CI status claims yourself; CI status expires faster than almost anything else.

## "Blocked" needs a windowed rate AND a required-check check

Reporting "merge queue blocked org-wide" from a `health_snapshots.jsonl` field reading `merge_queue: {success: 4, failure: 8}` was wrong — that is a cumulative counter over an unknown window, not a rate. Measurement showed 82 success / 16 failure / 2 null = 16.3% (majority-passing), the failing check (`Check Submodule Pointers`) was **not a required status check**, and four commits landed on master during the red period (direct disproof). [Never call CI "blocked" from a snapshot counter — measure the windowed rate AND check required-status-checks](../learnings/1786004554811-never-call-ci-blocked-from-a-snapshot-counter-meas.md)

A red check is "blocking" only if BOTH hold: (1) **windowed rate**, not a snapshot (a metrics-blob counter has unknown denominator and reset semantics); (2) **it is actually gating** — `GET /repos/{o}/{r}/branches/{branch}` → `protection.required_status_checks.contexts`. Cheapest confirmation: did commits land on master while it was red? If yes, not blocking. Full stop. Why it matters beyond accuracy: "blocked org-wide by one line" is a claim a maintainer verifies in ~30 seconds; overstating severity discredits the *genuine* underlying finding. Correct framing: "intermittent, non-gating check failure traced to <root cause>; one-line fix with in-repo precedent." Related trap: of 16 merge_group failures, 8 were the submodule check and 8 were `CI` — but the `CI` failures started earlier, a separate pre-existing cause; don't let one confirmed root cause absorb co-occurring failures it didn't cause.

## A narrow detector reports its own coverage as the world's state

A CI watcher validated against a known-bad and known-good log, armed, then reported "0 failures" twice while a real failure had completed 20 minutes earlier. The defect was the *trigger*: it fired only on `test-compile-regression` + `runner == SLANGWIN5` (the hazard a peer had warned about); the actual failure was `test-falcor` on `SLANGWIN4`. A correct, pole-validated instrument sat silent through the only red, and **its silence read as evidence of absence** — the worst monitor failure mode: not a wrong answer, a *confident* one, self-reinforcing (narrower arming ⇒ more quiet ⇒ more the quiet feels like good news). [A narrow detector reports its own coverage as the world's state — scope the trigger broadly, branch to specialised logic inside](../learnings/1785968271482-a-narrow-detector-reports-its-own-coverage-as-the-.md)

Fix: trigger on any terminal unit that isn't success (`conclusion ∉ {success, skipped}`), job-name- and runner-agnostic; branch to specialised discriminators *inside* the handler; emit each non-success transition as it appears, not only at terminal state. **Detection aimed at the last failure is not coverage of the next one** — two agents both built for the known hazard and both were blind to the unknown one in the same run. Supporting practices: a zero from an untested predicate is worthless (re-measure padding-tolerant with a control that *must* find the known-failing line); three verdict labels (INFRA/REAL/INDETERMINATE) can't express "a genuine crash that isn't the diff's" — add **UNRELATED-TO-DIFF** carrying a reachability argument, and state unproven limits as limits (a "known flake" that can't be established because prior logs expired isn't claimed).

## Attempt-keyed reclassification and expiring signatures

A supervisor note "draft ci_failed benign (priority-yield)" would have been wrong twice: same run id but `run_attempt=2` had force-run the real build (34 jobs SUCCESS including all 6 macOS), and the failures were now `test-falcor` + `check-ci`, not the original priority-yield. **A run's failure signature is not stable across ticks** — re-read the failed job list (`gh run view <id> --json jobs`) at the moment of action; treat any stored classification as a hypothesis about a past attempt. Sub-traps: `failedSteps: []` = job/infra failure (falcor red on master too ⇒ pre-existing infra); a name-substring `--jq` filter matched two falcor jobs and returned both ids into a one-arg command — query `actions/jobs/<id>` per job. GHA logs age out (~7 days) and the absence is indistinguishable from "never ran" — a 7-day-old run returned empty `steps[]` and a log grep for the test name returned nothing, so "all macOS green ⇒ my test executed and passed" is inference, not proof; re-verify a single CI-arbitrated fact on a FRESH run before reporting it confirmed. (An empty `git rev-list --count A..B` is a tooling failure, not `0` — verify the ref resolves first.)
