---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1789440049823-a7tvb7
written_at: 2026-09-15T03:53:57.478Z
---

# slang-rhi review lens: pooled staging + RAII free-on-scope-exit + queue-wait that can fail on OOM = in-flight page reuse

**Pattern (found reviewing slang-rhi#869, Vulkan readBuffer routed through the pooled `m_readbackHeap`):** When a readback path (a) submits a GPU→staging copy, (b) waits via `queue->waitOnHost()`, then (c) frees the staging allocation, watch the *failure* path between (b) and (c) when the staging comes from a SHARED pool.

- `CommandQueueImpl::waitOnHost()` (Vulkan) = `vkQueueWaitIdle` (src/vulkan/vk-command.cpp). Per Vulkan spec it can return `VK_ERROR_OUT_OF_HOST_MEMORY` / `OUT_OF_DEVICE_MEMORY` as well as `DEVICE_LOST`. **OOM is NOT device loss** — the queue is alive and the already-submitted copy may still be in flight. So "waitOnHost failing ⇒ device loss ⇒ any staging race is moot" is a FALSE premise; don't accept it.
- `StagingHeap::Handle` frees on scope exit: `~Handle() { m_heap->free(m_allocation); }` (src/staging-heap.h) → `StagingHeap::free()` (src/staging-heap.cpp) immediately `freeNode`s the region — **no completion fence/token**. If the RAII handle is freed on the post-`submit`/wait-failure path, the shared pooled region is marked reusable while its GPU copy may still be writing. **No concurrency required:** a later *sequential* readback allocHandle's the same region → torn/overwritten data. (The command buffer retains the `VkBuffer` object, so no native use-after-free — but the pooled *region* is reissued.)

**Also note the sibling asymmetry:** `Device::readTexture` (src/device.cpp) frees only AFTER success, so on failure it LEAKS the allocation → trips `StagingHeap::release()`'s `SLANG_RHI_ASSERT(m_totalUsed == 0)` at teardown (src/staging-heap.cpp:40). So "just mirror readTexture / detach-leak on failure" is ALSO not a fix — it re-triggers that assert. The only robust fixes: (a) couple the staging free to GPU/command completion (fence/token; free once the copy retires), or (b) a heap that quarantines/retains the region until completion is confirmed.

**Meta:** run the codex critique gate on the RESOLUTION/verdict, not just on code. Here it caught me closing this as "accept, 0 bugs, not blocking" on the device-loss premise; the OOM counterexample flips it to an open blocking error-path defect. The gate's OUTPUT_REVIEW=approve requirement forced the correction before delivery.
