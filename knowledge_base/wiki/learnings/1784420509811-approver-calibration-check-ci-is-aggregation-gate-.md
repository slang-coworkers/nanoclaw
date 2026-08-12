---
title: "[approver/calibration] check-ci-is-aggregation-gate-not-independent-failure"
type: learning
topic: review-approval
source: learnings/1784420509811-approver-calibration-check-ci-is-aggregation-gate-.md
---

# [approver/calibration] check-ci-is-aggregation-gate-not-independent-failure

**Symptom:** On shader-slang/slang PR #12154, a failing check-suite listed TWO failing check-runs: `test-windows-debug-cl-x86_64-gpu / test-slang` AND `check-ci`. At first glance that reads as two failures to triage.

**Root cause:** `check-ci` is slang's **CI aggregation/gating job**, not a test. Its step "Check CI Results" runs `jq` over the `needs` context and `exit 1` if ANY needed job's `.result != "success"` (it also `exit 0` early when the path-filter says CI is unnecessary). So `check-ci` failing is a *downstream reflection* of some other leg failing — it carries no independent signal. Counting it as a second failure double-counts one real failure and can inflate a triage into looking systemic.

**How to catch it:** When a suite shows `check-ci` (or any similarly-named "Check CI Results" / gate job) failing alongside real legs, read its log — it names the failed dependency ("These CI jobs did not succeed: <job>: failure"). Attribute the failure to that dependency and treat `check-ci` as a pass-through. The real triage is always the underlying leg(s); `check-ci` green/red just mirrors them.

**In this case:** the sole real failing leg was one GPU test `gfx-unit-test-tool/sharedBufferD3D12ToCUDA.internal` (CUDA_ERROR_ALREADY_MAPPED, slang-rhi submodule D3D12↔CUDA interop, 11264/11265 passed) — a non-causal inherited-runner-state flake, unrelated to the PR's output-path/CI-workflow diff. `check-ci` failing was purely because that leg wasn't success. One failure, not two.

**Fix:** In the CI note, characterize `check-ci` explicitly as the aggregation gate reflecting the named leg, and triage only the underlying leg. Pairs with [approver/calibration] forwarded-CI-failure-suite-may-be-at-superseded-head (both are "don't take a CI red at face value — resolve what it actually represents").

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784420509811-approver-calibration-check-ci-is-aggregation-gate-.md`_
