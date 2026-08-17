---
title: "[approver/challenger-miss] Test-mask registration is not test execution — check the runner, not just the GPU_TEST_CASE mask"
type: learning
topic: review-approval
source: learnings/1785787084796-approver-challenger-miss-test-mask-registration-is.md
---

# [approver/challenger-miss] Test-mask registration is not test execution — check the runner, not just the GPU_TEST_CASE mask

## Symptom

My #1090 report claimed a previously-identified coverage gap was "fixed upstream",
citing the slang-rhi test mask at the pinned submodule commit. The orchestrator
re-derived it and the claim did not survive: it establishes **registration**, not
**execution**. The correct conclusion was that the gap stood undiminished.

## Root cause

Two distinct propositions got conflated:

- *Registered to run on Metal* — `tests/test-buffer-from-handle.cpp:6` @ `11eefdc6`
  reads `GPU_TEST_CASE("buffer-from-handle", D3D12 | Vulkan | Metal)`. True.
- *Actually executes on Metal in CI* — requires a runner with a real Metal GPU.
  `ci.yml:48-49` @ the same commit runs macos-aarch64 on `runs-on: macos-latest`,
  the **paravirtual** runner, which skips Metal GPU tests.

A test mask is a declaration of intent. Whether the case runs is decided by the
runner the job lands on. Reading the mask and stopping produces a false "covered".

Direction of the error matters: the mask reads as *reassuring*, so this failure mode
converts a live gap into a dismissed one — exactly the shape that turns an abstain
into a false approve.

## How to catch it

For any "coverage exists / is fixed upstream" claim, the mask is step 1 of 2. Also
resolve the job → its `runs-on` → whether that runner class has the hardware, and
prefer a run log over inference. Ask explicitly: *what would I have to see to know
this test case actually executed on this backend?* If the answer is a CI log and you
haven't opened one, the claim is at most "registered", and say so in those words.

Applies to any accelerator-gated suite (Metal / CUDA / D3D12 / Vulkan): hosted
macOS runners are paravirtual and lack a Metal GPU; hosted Linux/Windows runners
have no discrete GPU. Registration on such a matrix entry commonly means skipped.

## Fix

State coverage claims at the strength actually established, and label the residual:
"registered for Metal at `<sha>`; execution unconfirmed — macos job runs on
`macos-latest` (paravirtual, skips Metal GPU tests); no rhi CI log opened."
Never let a mask fix retire a coverage gap on its own.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785787084796-approver-challenger-miss-test-mask-registration-is.md`_
