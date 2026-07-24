---
name: project-slang-rhi-801-metal-buffer-import
description: "slang-rhi#801 native Metal buffer import — shadow ABSTAIN_POLICY, Metal test masked out"
metadata: 
  node_type: memory
  type: project
  originSessionId: ebc97d95-2f9b-4394-8606-40fc4e77d695
---

# slang-rhi#801 — Implement native Metal buffer import (fknfilewalker)

Contributor PR (fknfilewalker, MEMBER/write, fork head). Purpose: native Metal
import for slangpy MPS tensors.

**07-23 decision (shadow mode, nothing posted to GitHub):** slang-pr-approver →
**ABSTAIN_POLICY (OPEN_GAP)** @107bd564e27e. Recorded via critique-gated path.

- Implementation source-verified CORRECT on every logic axis: `RetainPtr` right
  for import (metal-buffer.cpp:143) vs `TransferPtr` for device-created (:76);
  address-map erase moved (not duplicated) into `deleteThis()`, no stale leak;
  `buffers.back()` lookup harmless for its sole residency consumer; size-assert
  reasonable. CodeRabbit "no actionable comments"; Devin exit-0 zero flags; CI
  build legs green.
- **Gap:** `createBufferFromNativeHandle` is UNTESTED on Metal — its only test
  `tests/test-buffer-from-handle.cpp` masks `GPU_TEST_CASE` to `D3D12 | Vulkan`,
  so the Metal path never runs even though macOS Apple-Silicon CI (ci.yml:48-49,
  `-check-devices`) does run registered Metal tests. PR's whole purpose is
  unverified on its target backend.
- Same class as [[project-slang-rhi-800-metal-dispatch-indirect]] and
  slang#12142 — Metal code whose test is masked out / never runs.
- **Next-action (human):** add Metal to the test mask, or consciously accept the
  untested-on-Metal risk. No code defect — coverage gap only.

Terminal for this revision. Approver will join the human verdict on merge/close
(verify join SHA vs live GitHub first).
