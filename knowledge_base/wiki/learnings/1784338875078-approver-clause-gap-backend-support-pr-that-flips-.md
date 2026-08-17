---
title: "[approver/clause-gap] Backend-support PR that flips a docs support-matrix cell but leaves the feature's test masked-out is compile-only, never executed"
type: learning
topic: review-approval
source: learnings/1784338875078-approver-clause-gap-backend-support-pr-that-flips-.md
---

# [approver/clause-gap] Backend-support PR that flips a docs support-matrix cell but leaves the feature's test masked-out is compile-only, never executed

**Symptom:** slang-rhi#800 flips `docs/api.md`'s `dispatchComputeIndirect` Metal column from `:x:` → `yes` and adds real runtime product code (`src/metal/metal-command.cpp` `cmdDispatchComputeIndirect`), and all CI is green (23/23, incl. `build (macos, aarch64, clang, Release/Debug)` on real Apple Silicon). Surface reading: "green CI + docs say yes = supported and tested." That is wrong.

**Root cause:** The feature's tests (`tests/test-compute-indirect.cpp` — `compute-indirect`, `compute-indirect-zero`, `compute-indirect-offset`) all carry the device mask `GPU_TEST_CASE(..., D3D12 | Vulkan | CUDA)` — **Metal is excluded** (has been since #639/4ba237d, predating this PR). slang-rhi CI runs the full unit-test suite on the `macos-latest` runner (`./slang-rhi-tests -check-devices`), but each `GPU_TEST_CASE` only runs on the devices in its mask. So the macOS job **compiles** the new Metal code but **never executes** it — the "yes" in the doc is unbacked by any executing test. Green CI proves it builds, not that it works.

**How to catch it (transferable):** For any PR that (a) adds/changes backend runtime code AND (b) flips a support-matrix / capability doc cell to claim newly-supported, check whether the feature's test actually EXERCISES that backend, not just whether CI is green:
- Find the feature's `GPU_TEST_CASE(...)` and read its device-mask argument. If the newly-claimed backend is absent from the mask, the new path is compile-only.
- A green `build (macos, ...)` leg means "compiled + the tests that DO include Metal passed", never "this feature ran on Metal".
- The principled accompaniment to claiming support is adding the backend to the test mask (or a new backend-specific case). Its absence is a real gap, not a nit, for a support-claiming PR.

**Fix (procedure):** This is a genuine `OPEN_GAP`-class concern that (combined with a refuted 🔴 and fallback-tier uncertainty) supports ABSTAIN over WOULD_APPROVE in shadow mode — withhold for a human to confirm on Metal hardware or add the Metal test leg. If the maintainer merges as-is (likely — impl was textbook-correct), that's a withhold-on-safe agreement-adjacent outcome, NOT a false-safe. Watch the join: if merged with the Metal test still masked out, the "yes" ships untested — note that in the human-verdict learning.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784338875078-approver-clause-gap-backend-support-pr-that-flips-.md`_
