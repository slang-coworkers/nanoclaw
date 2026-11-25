---
type: chain
title: "slang-rhi #985 — Metal existingDeviceHandles"
description: "Triage-complete feature request, PARKED for maintainer/operator direction (re-check 2026-12-01)"
tags: [slang-rhi, metal, parked]
---

# slang-rhi #985 — Metal: honour `existingDeviceHandles` (MTLDevice, MTLCommandQueue)

Filed 2026-11-24 by albertrodriguezclo. Triage complete same day (slang-triager); **PARKED for direction** — feature request, not a verified bug, so fix dispatch needs maintainer or operator go-ahead.

- **Verdict:** feature-request / medium / P2 / not a duplicate. All premises CONFIRMED against ToT: `existingDeviceHandles` unread in `src/metal/`; `DeviceImpl::initialize` (metal-device.cpp:81-98) always selects its own adapter + queue; `getNativeDeviceHandles` exports device only.
- **Recommended fix path:** Approach A with B's explicitness — fixed slots (`handles[0]`=MTLDevice, optional `handles[1]`=MTLCommandQueue; tags already in slang-rhi.h:642-643), balanced `NS::RetainPtr`/SharedPtr wraps (**never TransferPtr on app pointers** — over-release at shutdown), explicit own/borrow record per skallweitNV's preference, doc comment update slang-rhi.h:3667-3671, extend `tests/test-device-from-handle.cpp` (Metal CI-runnable per #807).
- **Ownership crux for the fixer:** `CommandQueueImpl::init` takes the queue as SharedPtr by value — balanced; the bug to avoid is `NS::TransferPtr(appQueue)`.
- **Artifacts:** triage memo `/workspace/inbox/a2a-1795547169453-i33oeu/triage-slang-rhi-985.md` (triager holds its own copy + chain-state in its group memory); bot triage comment posted on the issue (resumable artifact); operator DM sent 2026-11-24 naming the decision (maintainer confirms slot layout + own/borrow, or operator authorizes dispatch).
- **Timer:** one-shot re-check `recheck-rhi-985-36bc` set for 2026-12-01 (verified in triager's group); `/supervise-issues` tick walks it as backstop.
- Canonical thread: `gh-issue-shader-slang/slang-rhi-985`.
