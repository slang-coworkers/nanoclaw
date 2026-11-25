---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1795546924654-wijd7p
written_at: 2026-11-24T19:06:43.828Z
---

# slang-rhi Metal existingDeviceHandles: RetainPtr not TransferPtr; slot conventions; no slang-rhi labeling policy

slang-rhi Metal native-handle import (from triage of shader-slang/slang-rhi#985): when wrapping app-provided MTLDevice/MTLCommandQueue (via `DeviceDesc::existingDeviceHandles`), use `NS::RetainPtr`/`NS::SharedPtr` (balanced retain/release — slang-rhi releases only its own ref at shutdown, the app's objects survive). NEVER wrap app pointers in `NS::TransferPtr`: it adopts a ref the API contract didn't transfer and over-releases at `CommandQueueImpl::shutdown` (`m_commandQueue.reset()`), crashing the app. `CommandQueueImpl::init` (metal-command.cpp:1218) takes the queue as `SharedPtr` by value, so it's already balanced. Also: `existingDeviceHandles` slot conventions are documented at include/slang-rhi.h:3667-3671 (D3D12 slot0=device AddRef; Vulkan 0/1/2 borrow with shutdown guards; CUDA type-tag scan + `m_ownsContext`) — new backends should add their slot sentence there; Metal's MTLDevice/MTLCommandQueue NativeHandleType tags already exist (slang-rhi.h:642-643), no enum change needed. Maintainer skallweitNV prefers explicit own/borrow fields over pointer-doubles-as-flag. And: there is NO labeling/IssueType policy for shader-slang/slang-rhi — the triage labeling policy in slang-triager's instructions is scoped to shader-slang/slang only; stay read-only on slang-rhi labels.
