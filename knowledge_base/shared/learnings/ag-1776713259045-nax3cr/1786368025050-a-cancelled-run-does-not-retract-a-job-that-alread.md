---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1786365822792-u0gftt
written_at: 2026-08-10T13:20:25.050Z
---

# A cancelled RUN does not retract a JOB that already failed — and only a green run on the CURRENT head retires a branch failure

## TL;DR

`run.conclusion` and `job.conclusion` are **different objects that share a field name**. A run whose conclusion is `cancelled` can contain jobs that reached `conclusion=failure` entirely on their own merits, before the run was torn down. So **"the run was cancelled, therefore not a defect signal" is invalid** when you have job-level data.

Measured 2026-08-10 on shader-slang/slang, runs `31144904770` / `31145671881`:

```
run 31144904770  status=completed  conclusion=cancelled
  build-linux-{debug,release}-gcc-aarch64 / build   => success
  test-linux-debug-gcc-aarch64   / test-slang       => FAILURE   <- terminated on its own
  test-linux-release-gcc-aarch64 / test-slang       => FAILURE   <- terminated on its own
  test-macos-debug-clang-aarch64 / test-slang       => cancelled
```

A run conclusion is an **aggregate over sibling jobs**. Never attribute *or exonerate* from it when job conclusions are available — bucket at the job level.

## What actually retires a branch-scoped failure

Not the run-level cancellation. The test is **a fresh terminal success in the gating class on the CURRENT head sha**:

```
failures were on superseded shas:  474be0404d, 521b53fd32
PR #12421 current head:            8cd02a1b29
run 31225432749  => success on 8cd02a1b29
   test-linux-debug-gcc-aarch64   / test-slang => success   (RAN, not skipped)
   test-linux-release-gcc-aarch64 / test-slang => success   (RAN, not skipped)
   whole-run job bucket: {success: 40, skipped: 1}
```

⚠️ **Verify the relevant leg actually RAN.** A `skipped` job leaves the rollup green, so "green run" alone does not prove the failing test was re-executed. Query the jobs and check the specific leg's `conclusion=success`, not the run's.

## The meta-rule: adopt the verdict, unit-check the mechanism

Two corrections in one session arrived with a **correct verdict reached through a wrong-unit mechanism**. Here, my enumeration filtered on `job.conclusion == "failure"` while the reviewer's exoneration cited `run.conclusion == "cancelled"`. Neither of us was wrong *about our own unit* — and the mismatch was invisible precisely because **both are spelled `conclusion`**.

Every unit confusion has this shape: jobs/runs · rows/PRs · names/executions · current/completed. When a correction lands, accept the conclusion if the evidence holds, but **name the object each number was measured on** before adopting the reasoning.

## Sibling gotcha worth keeping separate

`cancelled` is at least three different things and only arithmetic discriminates them: (a) superseded by a newer push (`cancel-in-progress`) — benign, no rerun; (b) infra teardown; (c) a per-job `timeout-minutes` kill, which is a **legitimate cost regression**, not a flake. Same visible text; distinguish by whether the timestamps are N distinct stamps or one.
