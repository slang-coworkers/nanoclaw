---
title: "[approver/calibration] combined-status-failure-from-non-causal-downstream-flakes"
type: learning
topic: review-approval
source: learnings/1784329341037-approver-calibration-combined-status-failure-from-.md
---

# [approver/calibration] combined-status-failure-from-non-causal-downstream-flakes

**Symptom:** On a clean, narrow front-end PR (#12131, assoc-type-of-link-time-export layout fix), the GitHub *combined commit-status* API returned `state=failure` even though the change was correct and every core slang test leg was green. Naively short-circuiting on combined-status → failure would have mis-classified this as BLOCK/ABSTAIN.

**Root cause:** The combined commit-status aggregates *all* contexts, including cross-repo and downstream integration jobs that have no causal path to a given change. Here two non-causal signals drove the red:
1. `test-falcor` — 1 of 110 D3D12 image-diff tests (`test_GBufferRTTexGrads_d3d12`) red, from a *previous* (draft) CI run; `check-ci` is a derived aggregator that goes red merely because it summed falcor.
2. `SlangPy Tests` (cross-repo `repository_dispatch`) — red on `tests/sgl/device/test_profiler.cpp`, a CPU-time/call-count *timing* assertion (`cpu_time_per_call.count==2`, `call_count==2`, `calls/frame mean=1`). Linux-only; **PASSED on Windows**; the job aborted at that C++ profiler stage before any reflection test ran.

**How to catch it:** When the `ci_green_on_sha` clause defers (policy `require_ci_green:false`), do NOT read the combined-status verdict as the answer. Instead: (a) enumerate the *individual* check-runs with `--paginate`; (b) confirm the repo's OWN core test legs are `success` on the pinned SHA — especially the leg that runs the PR's new tests (for a reflection/type-layout change that's `test-linux-release-gcc-x86_64-cpu`, which runs CPU REFLECTION/SIMPLE tests); (c) for each red context, open the job log and trace the failing test — a **platform-asymmetric** failure (red on linux, green on Windows) and a **timing/image-diff** assertion are strong flake signals; a failure in a *downstream renderer* (falcor) or a *cross-repo consumer's own device-layer test* (slangpy sgl profiler) that the PR's code path can't reach is non-causal. Also check the *timestamp*: a `failure` row from a prior draft run that a fresh matrix is currently re-running is stale.

**Discriminator that made this WOULD_APPROVE not ABSTAIN:** the reflection tests this PR actually adds ran and passed on the CPU leg; the red signals were in code the PR cannot influence. Contrast the false-safe risk of #12130 (ci_green blind to a real metal-fmod regression in check-runs) — the rule is symmetric: classify from *individual check-runs traced to cause*, never from the combined-status verdict alone, in EITHER direction.

**Fix/practice:** Record the raw check-run classification (which legs green, which red + their root cause + run IDs) in the challenger evidence so the non-causal call is independently auditable (codex advisory flagged this too). See sibling [[pr-12123-decided]] (classify from check-runs not combined-status) and [[pr-12130-decided]] (ci_green blind to check-runs).

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784329341037-approver-calibration-combined-status-failure-from-.md`_
