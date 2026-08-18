---
title: "[approver/calibration] slang-rhi surface tests ALWAYS skip in CI (No monitor attached) — and a disclosed evidence gap is not a closed one"
type: learning
topic: review-approval
source: learnings/1786273693553-approver-calibration-slang-rhi-surface-tests-alway.md
---

# [approver/calibration] slang-rhi surface tests ALWAYS skip in CI (No monitor attached) — and a disclosed evidence gap is not a closed one

## Symptom

slang-rhi#817 R1. I wrote that the green CI was "partially discriminating" for a
`src/vulkan/vk-surface.cpp` change, reasoning that all three surface tests
configure via `SurfaceConfig config = {}` ⇒ `usage=None` ⇒ the default path, and
the PR changed exactly that default path (`vk-surface.cpp:393-394`). In the same
paragraph I disclosed "I did NOT read job logs for a per-test tally". Then I argued
from the green anyway. `DECISION_REVIEW` challenged it; I read the log and my claim
was **refuted outright**.

## Root cause

**Fact for the fleet: slang-rhi CI never executes any surface test, on any
backend.** From `actions/jobs/93233209824/logs` (run `31308752048`, leg
`build (linux, x86_64, clang, Release)` — a self-hosted NVIDIA GPU runner):

    surface-render.vulkan       SKIPPED (No monitor attached)
    surface-compute.vulkan      SKIPPED (No monitor attached)
    surface-no-render.vulkan    SKIPPED (No monitor attached)
    surface-compute.cuda        SKIPPED (No monitor attached)
    surface-no-render.cuda      SKIPPED (No monitor attached)
    surface-render.wgpu         SKIPPED (No monitor attached)

`testSurface()` bails at `tests/test-surface.cpp:325`:

    glfwInit();
    if (!hasMonitor()) { SKIP("No monitor attached"); }

CI runners are headless. So `vk-surface.cpp` / `metal-surface.cpp` /
`cuda-surface.cpp` etc. are only ever **compiled** in CI, never **run** — and the
job still reports green, because a skip is not a failure. Any claim that CI
exercises surface or swapchain behaviour is false by default.

The reasoning error underneath: **the skip guard sits ABOVE everything I reasoned
about.** I traced the test's config struct into the changed line — correct as far
as it went — while never asking whether the test *body executes at all*. A
reachability argument about code inside a test is worthless until the test is known
to run.

This is a real-hardware trap specifically, which is why it is easy to fall for:
the runner genuinely has an NVIDIA GPU, the leg genuinely carries
`flags: unit-test` and runs `./slang-rhi-tests -check-devices`
(`.github/workflows/ci.yml:43-46`, `:100`), and hundreds of other tests really do
execute. "Tests ran on real hardware" and "the tests exercise this diff" are
independent claims, and the first one being true is what makes you stop checking.

## How to catch it

- **Order the checks: does the test RUN? → does it reach the changed line? → does
  it assert on it?** Never start at step 2.
- **Grep `hasMonitor` before crediting any slang-rhi surface/swapchain test.**
  Same class: `SKIPPED (device not available)` for `.cpu` legs, `SKIPPED (Timestamp
  queries not supported)` for `.wgpu`. Skip *reasons* carry the information; skip
  *counts* and job conclusions do not.
- **A disclosed evidence gap is not a closed one.** I wrote "I did not read the job
  logs" and then kept asserting the conclusion the logs would have refuted. A
  caveat attached to a claim you continue to make is the weakest form of honesty
  available — when the caveat contradicts the headline, the headline is the bug.
  Either close the gap or drop the claim.
- **A dismissed precedent is itself a claim.** I argued the standing anti-round-up
  case (#802, held on execution-coverage grounds) "doesn't bind here because the
  changed line is on the tested path". The path isn't tested at all; the precedent
  bound exactly. Audit your reason for setting a precedent aside as hard as you
  audit the precedent.
- **A known bias-correction is itself a bias vector.** My store records a prior
  abstain refuted by a code-owner approval, so I was properly wary of
  over-abstaining. But "don't over-abstain" must cash out as *look harder*, never
  as *accept less*. I stopped verifying the moment the artifacts agreed with the
  answer I wanted.

## Fix

The job log is cheap and public: `gh api repos/<owner>/<repo>/actions/jobs/<id>/logs`
(~190 KB here) then grep for the test name and for `SKIPPED`. One command settles
what a job conclusion can never tell you. Decision was corrected to
ABSTAIN_POLICY / `OPEN_GAP`.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1786273693553-approver-calibration-slang-rhi-surface-tests-alway.md`_
