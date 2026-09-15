---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1789372116137-lq9k8h
written_at: 2026-09-14T08:00:07.192Z
---

# slang-rhi CUDA: string_view-keyed intern map into ConstantBufferPool is lifetime-safe (issue 861)

When triaging a slang-rhi CUDA patch that interns packed global-param packets by byte-content — key type `std::unordered_map<std::string_view, CUdeviceptr>` where the `string_view` points into `objectData.host` (issue #861) — the obvious red flag is a dangling key. It is **NOT** a hazard here, and the reasons generalize:

- `objectData.host` comes from `ConstantBufferPool::Pool::allocate` (`src/cuda/cuda-constant-buffer-pool.cpp:96`), a **bump allocator**. Its pages are `HeapAlloc`s whose `getHostPtr()` returns an inline `address` (`include/slang-rhi.h:3135/3138`) pointing to memory heap-allocated **outside** the `std::vector<Page>`. So `vector<Page>` reallocation on `push_back` moves the Page structs but NOT the backing bytes → `string_view` keys stay valid across pool growth. Append-only during a build; no written region is rewritten/freed mid-build.
- Ownership: `BindingCache m_bindingCache` and `ConstantBufferPool m_constantBufferPool` are both members of `CommandBufferImpl` (`cuda-command.h:116-117`) → per-command-buffer, co-terminous. `CommandBufferImpl::reset()` clears the map (`m_bindingCache.reset()`, `:1465`) **before** freeing pool pages (`m_constantBufferPool.reset()`, `:1466`). The map is read only via `try_emplace` during building, never after free.
- The paired execution-side copy-skip (per-dest-symbol `m_globalParamsState` in `cmdDispatchCompute`) is correct because: `CommandExecutor` is strictly per-command-buffer (constructed in the `submit` loop, one `execute()` each); `computePipeline->m_globalParams` is a stable, distinct per-pipeline device symbol; the dispatch copy is its sole writer (ray-tracing reads `bindingData->globalParams` directly via optixLaunch and never copies into the symbol); the stream is single-threaded FIFO; and `cmdExecuteCallback` clears the cache. **The two halves are coupled**: source-pointer identity is a valid byte-equality proxy ONLY because interning canonicalizes device addresses — split them and correctness holds but the win mostly evaporates.

Method note: this was refuted by two parallel read-only code agents (one per half) + a DeepWiki architecture cross-check, not runtime (perf gain needs a CUDA/OptiX GPU). slang-rhi has no `reproduced`/`CUDA`/`perf` labels and no Issue-Type convention — `enhancement` is the right (and only) label for such an optimization.
