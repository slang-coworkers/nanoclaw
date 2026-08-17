---
title: "Runner-scoped CI defect: a rerun is a pool lottery, not a futile reland"
type: learning
topic: ci-tooling
source: learnings/1785838439742-runner-scoped-ci-defect-a-rerun-is-a-pool-lottery-.md
---

# Runner-scoped CI defect: a rerun is a pool lottery, not a futile reland

## The correction

When a CI failure is attributed to **one defective self-hosted runner**, the tempting conclusion is "rerunning is futile — it could land on the same bad box." That inference is wrong whenever the job's `runs-on:` is a **label set**, not a named host.

`runs-on: [Windows, self-hosted, regression-test]` dispatches to whichever box in that pool is free. If the pool has ≥3 members and ≥2 are healthy, a rerun is a **cheap probabilistic remedy** with good odds — not a guaranteed reland on the defect. "Same-runner reland" is a probability to weigh against the cap, not a certainty that justifies withholding.

## The evidence (shader-slang/slang, 2026-08-04)

Three attempts of the *same* CI run on *one unchanged head* (`ba156ebf`, PR #12322) — a controlled experiment where the runner is the only variable:

| attempt | runner | `spirv-val` tally | result |
|---|---|---|---|
| 1 | SLANGWIN5 | `[ 0 / 866 ]` | ❌ |
| 2 | SLANGWIN5 | `[ 0 / 866 ]` | ❌ |
| 3 | SLANGWIN4 | `[ 866 / 866 ]` | ✅ |

I withheld the rerun as futile; the PR author fired attempt 3 anyway and it went green immediately. The runner *attribution* was right and is now proven by within-PR control — but the *remedy* conclusion was wrong.

## Two reusable sub-lessons

**1. A runner defect can be job-scoped, so "reboot the box" is often the wrong ask.** On the same SLANGWIN5 in the same window: `test-benchmark` succeeded 4/4, `test-falcor` succeeded, and an MDL-benchmark `build` succeeded — while `test-compile-regression` failed 3/3. The host was healthy; one *mechanism* (SPIR-V validation) was broken on it. Escalating "recycle the runner" would have been rejected as unfounded. Check for a **within-window, same-box success on a sibling job** before naming the remedy.

**2. Prove the attribution with a differential over the runner, not over time.** Enumerate every instance of the failing job repo-wide in the window and tabulate by `runner_name` (from `actions/runs/<id>/attempts/<N>/jobs`, which carries per-attempt runner assignment). A clean split — one box N/N failing, siblings M/M green on the identical job — is far stronger than "it failed twice in a row."

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785838439742-runner-scoped-ci-defect-a-rerun-is-a-pool-lottery-.md`_
