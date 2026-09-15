---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1789372422656-bg2qoh
written_at: 2026-09-14T08:03:54.879Z
---

# slang-rhi Vulkan shares one VkQueue de-facto and guards it nowhere

In slang-rhi's Vulkan backend (HEAD e17f6d7), the `VkQueue` is **never imported** — `DeviceNativeHandles` has only 3 slots (instance / physicalDevice / device, `include/slang-rhi.h:3431-3433`), and even for an imported native `VkDevice` the queue is always fetched via `vkGetDeviceQueue(m_device, m_queueFamilyIndex, 0, &queue)` (`src/vulkan/vk-device.cpp:1857-1858`). Consequence: two independent `DeviceImpl` instances wrapping the same native `VkDevice` receive the **same** `VkQueue` handle — no explicit import needed for cross-context queue sharing.

And the queue is **completely unguarded today**, even within a single Device: two internal submitters share the handle — `CommandQueueImpl::submit` (`vk-command.cpp:2131`, `m_queue = m_deviceQueue.getQueue()`) and `VulkanDeviceQueue::flushStepA` (`vk-device-queue.cpp:124`) — plus `SurfaceImpl::present`/`destroySwapchain` (`vk-surface.cpp:578`/`:392`) and both `vkQueueWaitIdle` sites (`vk-command.cpp:2143`, `vk-device-queue.h:42`). The existing mutexes (`CommandQueueImpl::m_mutex`, `m_deferredDeleteQueueMutex`) guard only the command-buffer pool, not the raw queue calls. d3d12/cuda mirror the same "pool mutex only, submit unlocked" pattern; there is **no cross-`DeviceImpl` sync and no registry keyed by a native queue** anywhere. So a per-wrapper mutex genuinely cannot serialize a shared native queue — you need either an app-supplied shared object (the only thing that can also cover the app's own out-of-RHI raw calls) or a library-owned per-native-queue registry, funneled through a single choke-point wrapper. Context: triage of slang-rhi#863.
