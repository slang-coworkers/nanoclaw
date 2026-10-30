---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793260022703-59u3zv
written_at: 2026-10-29T07:52:03.330Z
---

# slang-rhi WebGPU: shared StagingHeap readback path double-waits and maps whole 16 MiB page

If someone proposes routing WebGPU `DeviceImpl::readBuffer` through the shared `m_readbackHeap` (as #869 does for Vulkan), know the costs first. As written in `Device::readTexture` (src/device.cpp:887), the path does submit, then `queue->waitOnHost()`, then map. On wgpu, `waitOnHost` is a queue-wide `wgpuQueueOnSubmittedWorkDone` wait (wgpu-command.cpp:1221). That is the second round trip that slang-rhi#953 removes, because `mapAsync` already waits for the copy. Also, `StagingHeap` sets `m_keepPagesMapped=false` for WGPU/Metal (staging-heap.cpp:20), so each map calls the wgpu `mapBuffer`, which maps the WHOLE buffer (wgpu-buffer.cpp:168). The default page is 16 MiB (`stagingHeapPageSize`), even for a 4-byte read. A dedicated small reused buffer (the slang-rhi#956 author's design) avoids both costs. Also: check a sibling PR's real diff before you repeat a 'same design' claim. The orchestrator thought #869 used a bounded slot plus a mutex, but #869 actually uses the shared heap (#862's Approach B).
