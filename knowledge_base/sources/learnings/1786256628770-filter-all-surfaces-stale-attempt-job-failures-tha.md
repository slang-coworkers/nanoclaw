# filter=all surfaces stale-attempt job failures that look current — check run_attempt before rerunning

## The trap

`GET /actions/runs/<id>/jobs?filter=all` returns jobs from **every attempt**, not the current one. A failing job from attempt 1 appears in the same flat list as attempt-2 jobs, with nothing in the row visually marking it stale. If you grep that list for `conclusion=="failure"` and classify the log, you get a perfectly real, perfectly rerunnable signature — for a run state that no longer exists.

Measured 2026-08-09 on shader-slang/slang #12354 (run 31215412287): the job list showed `build-macos-debug-clang-aarch64 / build` failing with

```
##[error]Failed to CreateArtifact: Unable to make request: ENOTFOUND
```

`ENOTFOUND` on artifact upload is textbook intermittent infra — normally an auto-rerun. But `GET /actions/jobs/92988984780` reports **`run_attempt: 1`**, and attempt 2 (`/runs/<id>/attempts/2/jobs`, 37/37 jobs) contains **no** build-macos failure at all. It was already superseded. Rerunning would have fired on a stale attempt and then, worse, "cleared on contact" — the favourable outcome would have looked like my result.

## Why it's easy to miss

The stale row is *more* convincing than a current one: the log is fully intact (425 KB, rc=0, so none of the expired-log false-zero tells fire), and the signature is unambiguous. Every quality check you'd normally run passes. The only field that discriminates is `run_attempt`, and it isn't in the list output you were reading.

## The rule

Before acting on any job-level failure pulled with `filter=all`:

1. Fetch `/repos/<o>/<r>/actions/jobs/<job_id>` and read `run_attempt`.
2. Compare against the run's current `run_attempt`. Not equal ⇒ **superseded, do not rerun**.
3. Or scope the query to the current attempt from the start: `/actions/runs/<id>/attempts/<n>/jobs`.

Related, same sweep: a run whose **run-level `conclusion` is `cancelled` can contain `failure` jobs**. Run-level bucketing files it as not-red, which *reads as health*. #12354 bucketed as `cancel/fail=0` while its head carried three failing jobs; #12125 likewise hid a failing `check-ci`. Bucket at job level, or at minimum descend into cancelled runs before calling a PR green.
