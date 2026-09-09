---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787809359214-d5lpej
written_at: 2026-08-27T05:51:33.009Z
---

# slang-rhi ConstantBufferPool is per-command-buffer, duplicated across 5 backends, and reset() frees pages only on CUDA

Triaging slang-rhi#844 (multi-GiB upload-buffer retention → D3D12 "Failed to get binding data"). Source-verified facts about the RHI runtime that no shared learning covered:

**Architecture:** `ConstantBufferPool` is a **direct member of each backend's `CommandBufferImpl`** (per-command-buffer, not per-device). There is **NO shared base class or header** — it's a fully duplicated copy in D3D12, Vulkan, D3D11, CUDA, WGPU (Metal/CPU have none). A behavior fix must be applied per-backend.

**The leak pattern:** On D3D12/Vulkan/D3D11, `ConstantBufferPool::reset()` only rewinds cursors (`m_currentPage=-1; m_currentOffset=0;`) and does **NOT** free `m_pages`. Pages (D3D12/Vk = 4 MiB `MemoryType::Upload`, D3D11 = 64 KiB) live until `~CommandBufferImpl`. Combined with `CommandQueueImpl::m_commandBuffersPool` — a `std::list<RefPtr<CommandBufferImpl>>` that's uncapped and cleared only in `shutdown()` — retention = (peak concurrent CB count) × (pages/CB) × pageSize, a permanent high-water mark. **CUDA (16 KiB) is the correct model: its `Pool::reset` frees every page back to the heap and `clear()`s the vectors.** WGPU frees only its `m_largePages` list, keeping normal pages.

**GPU-safety of free-on-reset:** `reset()` is reached only via `retireCommandBuffer()`, which is fence-gated (`retireCommandBuffers()` gates on `m_submissionID <= lastFinishedID`). GPU is guaranteed done, so releasing pages on reset is safe — CUDA already relies on this.

**Error masking:** the three binding-data call sites in `src/command-buffer.cpp` (render/compute/ray-tracing) check only `SLANG_FAILED(...)` and discard the `SlangResult`, collapsing ConstantBufferPool OOM (`createBuffer` for a new page) and descriptor-allocation failures into one generic "Failed to get binding data". Propagating the real result is an orthogonal, worthwhile fix.

**META lesson — DeepWiki was stale/wrong here:** DeepWiki confidently asserted `reset()` "clears all allocated pages, releasing memory back to the device heaps." Source proves the opposite (cursor-only) on the 3 leaking backends. When a triage hinges on a specific code behavior, the source-grounded subagent overrules DeepWiki every time; DeepWiki is for architecture/flow, not line-level behavior.
