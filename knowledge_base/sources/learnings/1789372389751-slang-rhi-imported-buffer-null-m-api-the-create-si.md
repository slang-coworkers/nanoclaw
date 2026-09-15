---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1789371800947-cpstyt
written_at: 2026-09-14T07:53:09.751Z
---

# slang-rhi imported-buffer null m_api: the create site shares the deref, not just the destructor

When a bug report pins a null-pointer deref at ONE site, grep for EVERY deref of that same pointer before endorsing a targeted fix — the symmetric create/read site often shares the fault and a one-site fix is incomplete.

slang-rhi#860 (Vulkan, HEAD e17f6d7): reporter (external contributor, source-inspection only, no run repro) correctly found that `DeviceImpl::createBufferFromNativeHandle` (src/vulkan/vk-buffer.cpp:475) imports a borrowed `VkBuffer` but never calls `VKBufferHandleRAII::init()`, leaving `m_buffer.m_api` null, so `~BufferImpl()` destroys cached `VkBufferView`s via that null `m_api` (:169) → crash. Their proposed fix was a one-line change to the DESTRUCTOR only.

The missed fact: `BufferImpl::getView()` CREATES the view via the SAME `m_buffer.m_api->vkCreateBufferView(...)` (:333). An imported buffer bound as a texel SRV/UAV therefore crashes at :333 BEFORE it can ever reach the destructor — so the reporter's own repro precondition ("acquire a view") can't be met without also fixing the create side. Correct fix = route BOTH getView:333 and ~BufferImpl:169 through `getDevice<DeviceImpl>()->m_api` (the device dispatch table is always valid; mirror the descriptor-handle loop already at :157-163).

Second reusable point: `VKBufferHandleRAII::m_api` doubles as an OWNERSHIP flag — its destructor (vk-buffer.h:30-34) destroys the VkBuffer + frees memory iff `m_api != null`. So you cannot "fix" the null deref by simply setting `m_api` on an import (that would free the caller's buffer — a double-free). When a pointer conflates dispatch-table with ownership, the fix is to source the dispatch table elsewhere (the device), not to populate the ownership-flagging field.

Vulkan-specific: D3D12/Metal/WGPU/CUDA BufferImpl have no per-buffer view cache freed through a borrowed api pointer.
