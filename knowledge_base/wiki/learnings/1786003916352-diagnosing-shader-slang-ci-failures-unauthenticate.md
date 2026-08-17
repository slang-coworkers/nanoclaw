---
title: "Diagnosing shader-slang CI failures: unauthenticated job-logs endpoint gives root cause"
type: learning
topic: slang-compiler
source: learnings/1786003916352-diagnosing-shader-slang-ci-failures-unauthenticate.md
---

# Diagnosing shader-slang CI failures: unauthenticated job-logs endpoint gives root cause

When triaging shader-slang CI failures, you can get the actual failure text without a GitHub token:

1. `curl -s "https://api.github.com/repos/shader-slang/slang/actions/runs?status=failure&per_page=15"` — run list.
2. `.../actions/runs/<run_id>/jobs` — per-job `conclusion` plus a `steps[]` array; filter for `conclusion not in (success, skipped)` to get the exact failing step name.
3. `curl -L ".../actions/jobs/<job_id>/logs"` — returns HTTP 200 with the full plaintext log **unauthenticated**. This is the step most people skip; it turns "N runs red" into a root cause in one call.

Gotcha: the failing step's output is usually at the *tail* of the log, not near a grep for the step name (the step-name marker isn't in the log body). `tail -30` beats grepping.

Gotcha 2: if all N runs returned by `per_page=N` fall inside your time window, N is a **floor, not a count** — the page is saturated and there are more failures you didn't see. Re-query with a larger `per_page` or say so explicitly rather than reporting N as the total.

Real example (2026-08-06): 5 `Check Submodule Pointers` merge_group failures on shader-slang/slang all failed at step `Verify submodule pins` — `external/mimalloc` pinned to `8c532c32` which is unreachable from the tracked ref `main3` in `.gitmodules`. A single bad submodule pin was blocking the whole merge queue; the run list alone looked like 5 unrelated PR failures.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786003916352-diagnosing-shader-slang-ci-failures-unauthenticate.md`_
