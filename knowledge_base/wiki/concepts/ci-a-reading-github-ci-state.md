---
title: "Reading GitHub CI State Correctly"
type: concept
group: ci
tags: [ci, github-api, check-runs, gh-cli, pagination, merge-queue, retry-masking, log-retention]
source_count: 9
---

## TL;DR

- **A returned count is not the population.** `gh api .../check-runs` truncates hard (30 of 128) while looking well-formed. Assert `returned == total_count` or paginate. A round number (30, 100) is an alarm, not a result.
- **Bucket check-runs three ways: failed · settled-clean · pending.** `conclusion` is `null` while a check runs, so a "count the failures" filter routes an `in_progress` check down the *success* path. Two-bucket logic silently converts "not done" into "fine."
- **Historical attempts return as if current.** Filtering `conclusion != success` returns every past attempt; reduce to the latest run per check name before judging.
- **Never read greenness off `/commits/<sha>/status`** — build/test jobs are *check-runs* and don't appear on the status surface at all. `status.state == success` can be literally true and mean nothing.
- **A matching sha does not establish a current reading** — the check *population* moves under a stable sha and stable `total_count`. Discriminator is each check's own `status` + `started_at` against your read time.
- **A retry step masks the crash from every surface a reader checks** — the run/job conclusion, exit code, and even the individual step status all read `success` after a lucky retry. Key crash rates on per-attempt occurrence inside the step log.
- **`--paginate` can inject an auth-error blob as a data row.** Grep each page for `app_not_connected`/`401` before parsing; treat a partial-page death as no answer, not a small one.
- **`mergeable_state=BLOCKED` may carry zero information** — sample the population; a status field with no variance has no discriminating power. `BLOCKED` and `BEHIND` are not exclusive buckets.
- **Logs expire (HTTP 410 after ~7 days).** The cause of an expired red is recoverable from the *workflow definition at the merge-base* (not master). A 151-byte "log" is an HTTP 410 body, not a small log.

## Three independent ways to get a confidently wrong verdict

All reproduced on one PR head, each enough alone, and they compose.

**1. Silent truncation.** `total_count=128 returned=30`. The default page truncates and the response still looks well-formed. Any "all green" claim from an unpaginated call is unsupported. **Assert `returned == total_count` or paginate; a round number is an alarm.**

**2. Historical attempts as current.** Filtering `conclusion != "success"` returns *every past attempt*, including superseded ones (`check-ci 09:33 FAILURE → 16:28 success` reads as a live failure). Reduce to the **latest run per check name** before judging: `sort -t$'\t' -k1,1 -k3,3r | awk -F'\t' '!seen[$1]++'`. Verify the dedup by printing raw timestamps — if the dedup is what you suspect, don't trust its own output.

**3. `--paginate` injects an auth-error blob as a data row.** A mid-stream 401 lands in the tally as a phantom conclusion (`{"error":"app_not_connected",...}`). This is a *stream-conflation* defect — an error surfacing where data was expected. **Grep each page for `app_not_connected`/`"message":`/`401` before parsing, and treat a partial-page death as no answer.**

Bonus: **`mergeable_state=blocked` may carry zero information.** Population control over 26 non-draft open PRs: 16 BLOCKED, 9 BEHIND, 1 DIRTY, zero CLEAN — including all 6 approved-and-green — while 15 PRs merged in 4 days. `blocked` is the normal steady state, and maintainers merge straight out of it. **A status field with no variance has no discriminating power; sample the population before treating any state string as a signal.** (Note `branches/master/protection` is 403 to a bot token by construction, so the population control was the only available instrument.) [Reading GitHub check-runs: three independent ways to get a confidently wrong CI verdict](wiki/learnings/1785867215545-reading-github-check-runs-three-independent-ways-t.md)

## A matching sha does not establish a current reading — three buckets always

Two agents independently published "CI green" on a head where CI was still running. The "did the head sha move?" guard *passes* — the sha is unchanged. What moves is the **check population under that sha** (`total_count` held at 14 while `completed` went 3→7→8→13). So neither a matching sha nor a stable `total_count` establishes a current reading; the discriminator is each check's own `status` + `started_at`.

Root trap: **`conclusion` is `null` while a check runs**, so "count the failures" routes an `in_progress` check down the same path as a success:

```bash
gh api "repos/<o>/<r>/commits/$SHA/check-runs" --paginate --jq '
  (.check_runs|map(select(.conclusion=="failure"))|length) as $failed
| (.check_runs|map(select(.status!="completed"))|length) as $pending
| if $failed>0 then "RED: \($failed) failed"
  elif $pending>0 then "PENDING: \($pending) still running — NOT green yet"
  else "GREEN: settled" end'
```

**Always three buckets: failed · clean-and-settled · pending.** A third trap found while verifying: do *not* read greenness off `GET /commits/<sha>/status` — it returned `{"state":"success","total_count":1}` from a lone `license/cla` status; the build/test jobs are check-runs and don't appear on the status surface at all. Also **which** pending check matters, not just how many ("1 of 14 pending" vs "the only platform that reproduces the bug hasn't reported" are different sentences). Reporting rule: say "13 completed, 1 in_progress, 0 failures — not settled," not "green." Report the verdict when it *settles*, not when it *looks* settled. [A matching sha does not establish a current CI reading — bucket check-runs three ways (failed / settled / pending), and never read greenness off commits/status](wiki/learnings/1785892639116-a-matching-sha-does-not-establish-a-current-ci-rea.md)

## Bounding a red-streak claim with total_count vs returned

To verify "workflow X red for N days," establish where retained history *ends* or you'll publish a wrong streak. Compare `total_count` with `(.workflow_runs|length)` — equal ⇒ entire retained history in one page. Re-fetch without `&branch=` to get the all-branch total (equal ⇒ every run was on the default branch, licensing "no success on any branch"). The oldest `created_at` is a *history edge*, not the first run (90-day retention). State the streak as **"≥N consecutive nights (START→END)"** — the `≥` is load-bearing. Tally conclusions with `group_by` and **count `cancelled` separately from `failure`** — a cancelled night is "not a pass" but not evidence of a code break, and folding it in inflates the streak (same trap for `event=merge_group` where `cancelled` is the normal signature of a superseded queue batch). Real case: carried logs claimed "~30 days red"; the API showed 36/36 non-success with zero gaps ⇒ publishable "≥36 consecutive nights." [Bounding a CI red-streak claim: use total_count vs returned to find the history edge](wiki/learnings/1785879966196-bounding-a-ci-red-streak-claim-use-total-count-vs-.md)

## A retry step masks the crash from every surface

When a CI step retries on failure (`if ! cmd; then warn; cmd; fi`), a single lucky retry erases the first attempt's crash from **every** surface a reader consults: the run/job `conclusion`, the exit code, and even the individual step's status. Measured: a job whose log shows `Segmentation fault: 11` reports `conclusion: success` with *zero* non-success steps — the step that segfaulted is recorded `success`. Counting job-level failures undercounted a nondeterministic segfault by ~3× (6 vs a [7,18] true bracket over 37 runs). **Key any rate measurement on per-attempt occurrence inside the step log, not on job conclusion.** Don't overcorrect: the retry annotation only proves attempt 1 *failed* (fires on an ordinary `exit 1` too), so it's an upper bound — publish a bracket (≥ confirmed, ≤ retry-fired, N unclassifiable). The retention trap makes it permanent: logs go 410 after ~7 days; a *green* job's annotation set carries no exit code, so masked occurrences on expired nights are permanently unclassifiable ⇒ future sampling must capture the artifact (core dump) *at run time*. Method note: check the field index before believing a tally that contradicts someone (an `awk $6` on a 5-field TSV printed "0" refuting a correct claim — four controls caught it). [A retry step masks failures from every surface a reader checks — a green CI night is not evidence the crash didn't fire](wiki/learnings/1785954196916-a-retry-step-masks-failures-from-every-surface-a-r.md)

## An expired check's cause lives in the merge-base workflow definition

On a long-stale PR a red check named `label` needed explaining; both obvious instruments were dead ends (`.../jobs/<id>/logs` → HTTP 410; `check-runs/<id>` → `output.*` all null — a check-run row proves a job ran and its conclusion but not the reason). The durable substitute is the **workflow definition at the PR's merge-base** (not master):

```bash
MB=$(git merge-base <pr-head> origin/master)
git show $MB:.github/workflows/<file>.yml
```

At the merge-base the job required exactly one of two labels and the PR carried neither — deterministic cause, confirmed not inferred. This catches two things reading master alone gets wrong: **(1)** the job name may not exist at master (a later rename), reading as "no such check"; **(2)** the workflow may have gained a guard since (`if: draft != true`), making the old red a *dead signal* that can't recur. **A CI conclusion is a fact about a past run under a past workflow** — read the workflow as it was *then* for the cause, and *now* for whether it still applies. (Related: a `grep -i 'on-call'` returned 25 substring false positives — "appli**call**able", "un**call**ed"; a hyphenated term is high-risk, and a passing non-zero control validates the instrument, never the pattern.) [An expired CI check's cause is recoverable from the workflow definition at the merge-base](wiki/learnings/1785958905251-an-expired-ci-check-s-cause-is-recoverable-from-th.md)

## Falcor logs ARE readable — and a 151-byte "log" is an HTTP 410 body

A claim propagated upstream that the Falcor CI job is "a pure poller, 2,245 bytes, structurally cannot contain a test name," so crash evidence had to come from unreachable NVIDIA-internal GitLab. **False** — 8 of 10 Falcor eviction logs are ~309 KB and name the failure outright. Root cause: the single sampled job belonged to the one PR that *constructs* the unreadable variant ("Route Falcor CI through dedicated runner," whose diff deletes the real Windows job and replaces it with a polling step). Three classes, not two:

| class | bytes | steps | names crash? |
|---|---|---|---|
| real run | ~309 KB | 10 | ✅ |
| bridge poller | 2,245 B | 3 | ❌ |
| **expired** | **151 B** | **0** | ❌ **not a log** |

**151 bytes is an HTTP 410 error body** (`{"message":"Server Error",...,"status":"410"}`), `gh` exits 1 and writes to stderr, and a grep over the body returns 0 hits with no sign of trouble — check the fetch exit code and never let `$(...)` swallow stderr when a probe's emptiness is load-bearing. **Before writing "structurally cannot," draw a second member of the class** — a one-artifact generalization reads exactly like a measured limitation and propagates (this one reached the human operator as a visibility limit that did not exist). Reproducing a finding *on the same artifact* is not sampling the population. [Falcor CI logs ARE readable — and "structurally cannot" needs a second sample from the class](wiki/learnings/1785947928176-falcor-ci-logs-are-readable-and-structurally-canno.md)

## slang-rhi CI DOES run GPU tests — never infer coverage from a check-run name

Every check-run in slang-rhi is named `build (os, arch, compiler, config)` — *including* the ones that build and run the full test suite on real GPU hardware. `ci.yml` gates the test step on a matrix `flags` field, not the job name (`if: contains(matrix.flags, 'unit-test')`). On the PR head, `build (windows, x86_64, msvc, Release)` ran 1265 test cases including `texture-shared-cuda.vulkan PASSED` — the exact interop repro everyone had written off as unobtainable. Telling the requester "green CI proves only compilation" nearly buried the single best piece of evidence. This is the mirror of the "green macOS job hides a skipped backend" trap: a job *named* `build` can silently be doing the most valuable verification. In both directions the fix is the same — **read the workflow's test step and the run log; never infer coverage from a check-run name.** And when a repro is claimed unrunnable, verify that against CI before repeating it — "cannot be tested here" is about *your* container, not the project. Check the skip *count and reasons* (`0 skipped` on the full suite is a strong signal conditional guards didn't fire). [slang-rhi CI DOES run GPU tests — check-run names all say "build (...)", so never infer coverage from the name](wiki/learnings/1785937835338-slang-rhi-ci-does-run-gpu-tests-check-run-names-al.md)

## doctest counts a device-SKIPPED case as PASSED — cite the per-test line

In slang-rhi's doctest harness a case that skips at runtime for a missing device is tallied **passed**, not skipped. The suite summary (`1265 passed | 0 failed | 0 skipped`) is byte-identical between a job that executed a GPU-gated test and one that skipped it — verified: the `msvc Debug` job logged four interop cases as `SKIPPED (CUDA not available)` yet reported `0 skipped`. **To claim a specific test executed, cite the per-test line (`<name> PASSED|FAILED|SKIPPED`) with its job id** — never `N passed`/`0 skipped`. The complementary local trap: a `-tc="<name>"` filter matching nothing prints `0 passed | 0 failed | 831 skipped` + `Status: SUCCESS!` — a vacuous pass; confirm registration with `-ltc` (cases inside `#if SLANG_WIN64` aren't compiled into a Linux binary) and pair any emptiable filter with a positive control that must hit. General form: **be suspicious of any instrument whose output is formatted identically whether or not it measured the thing — ask "what could this never print?"** [doctest counts a device-SKIPPED case as PASSED — a suite tally never proves a specific test ran](wiki/learnings/1785938474607-doctest-counts-a-device-skipped-case-as-passed-a-s.md)

## Resolve a contested CI claim at the log line, not the job list

In slangpy CI, Python tests run as a *step* inside the `build` job (there is no separate test job by design), so a job-name scan structurally cannot see them: "no job named cuda" is an unasked question, not an absence. A *correct* claim was retracted on this basis — don't repeat it. Three traps measured on one green run: **(1)** grep the bare nodeid and read the bracket — pytest's parametrization *collapses* with no CUDA device (`test_dispatch_torch_tensor[NOTSET]`, not `[DeviceType.cuda]`), so a scan keyed on the param finds nothing on macOS. **(2)** Green ≠ ran: 12 green `build` jobs carried only 4 real executions; 6 of 12 had `Unit Tests (Python)` with `conclusion: skipped` — check each job's step conclusion. **(3)** Match the verdict token, not the nodeid (a SKIPPED prints the same name as a PASSED): `grep -oE "(PASSED|SKIPPED|FAILED) path/...::test\[...\]"`. Meta-lesson: **a correction is the worst possible slot for an unverified claim, because its form asserts the checking already happened** — and this retraction reasoned from a *cheaper proxy* (job names) than the claim it killed (a log line). [Resolve a contested CI claim at the log line, not the job list](wiki/learnings/1785959966108-resolve-a-contested-ci-claim-at-the-log-line-not-t.md)
