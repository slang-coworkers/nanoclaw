---
title: "A job-scoped runner defect is invisible to box-health checks — bucket per (runner, job class), not per runner"
type: learning
topic: ci-tooling
source: learnings/1785962011577-a-job-scoped-runner-defect-is-invisible-to-box-hea.md
---

# A job-scoped runner defect is invisible to box-health checks — bucket per (runner, job class), not per runner

## The datum (2026-08-05, whole-day, 4-way bucketed)

Slang's `test-compile-regression` job draws from a 3-member self-hosted pool. Keyed on **job `started_at`** (not run `created_at`, which is attempt-1's stamp and therefore hides every rerun — exactly the population a CI babysitter cares about), over all 33 CI runs of the day:

| runner | compile-regression |
|---|---|
| SLANGWIN5 | **0 success / 6 failure** |
| SLANGWIN4 | 6 / 0 |
| SLANGWIN10X64-1 | 10 / 0 |

Healthy boxes **16-for-16**; SLANGWIN5 **0-for-6**. Ratios computed from `success + failure` only — `cancelled` jobs are UNTESTED, and folding them into either bucket biases the result (failure-only counting hides the unknown as "fine"; an outcome ratio over `total` counts it as "bad").

## Why a box-health check can't see it

The same box, same day, other job classes: **test-benchmark 11/11 success, test-falcor 14 success / 5 failure.** SLANGWIN5 is not sick — it is *selectively* broken. The defect is that the SPIR-V validator scores zero while compilation is green:

```
PASSING [ 866 / 866 ]                              <- every shader compiles
PASSING spirv-val [ 0 / 866 ]                      <- validator scores nothing
PASSING Non-Semantic Info [ 866 / 866 ]
PASSING Non-Semantic Info spirv-val [ 0 / 866 ]
```
exit 255, with a perfectly interleaved 1732 ` - PASS` / 1732 ` - FAIL` ladder (866 shaders × 2 modes: compile passes, validate fails, every time). No validator *diagnostic* is ever emitted — it doesn't reject the SPIR-V, it fails to score it, which points at a broken validator binary/toolchain on that box rather than bad compiler output.

Because the box passes every other job class, **any runner-health trigger keyed on per-runner success rate reads SLANGWIN5 as healthy** and never fires. The defect only exists at the (runner, job class) intersection.

## How to apply

- **Bucket CI outcomes by the PAIR (runner, job class), never by runner alone.** A per-runner aggregate averages a job-scoped defect away against the box's healthy job classes — here 25 successes on benchmark/falcor drown 6 straight compile-regression failures.
- The same argument runs the other direction and is the stronger diagnostic: to prove a defect is **job-scoped rather than a sick host**, show the box succeeding on *other* job classes in the same window. That's what turns "flaky runner" into a precise, actionable depool/repair ask.
- **A pool label is not a machine.** `runs-on: [Windows, self-hosted, regression-test]` selects one of N boxes, so a rerun is a lottery: with 1 of 3 defective, a rerun has ~2/3 odds of drawing healthy. That makes rerun a cheap *probabilistic* remedy — but it is a workaround, and re-landing on the bad box is common (observed the same day: a rerun re-drew the defective box and re-failed identically).
- **Key everything on the JOB's `started_at`.** Run-level `created_at` is attempt 1's timestamp, so "runs since T" silently drops reruns; run-level `.conclusion` likewise reports only the latest attempt. Enumerate `/attempts/<n>/jobs` per attempt.
- When quoting cost to a maintainer, quote **evictions**, not reruns — a rerun cannot restore a lost merge-queue position, so the eviction count is the real toil figure.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785962011577-a-job-scoped-runner-defect-is-invisible-to-box-hea.md`_
