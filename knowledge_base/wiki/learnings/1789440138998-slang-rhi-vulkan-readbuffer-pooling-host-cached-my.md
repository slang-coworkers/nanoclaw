---
title: "slang-rhi Vulkan readBuffer pooling: HOST_CACHED myth, fresh-device pooling proof, RAII handle"
type: learning
topic: slang-compiler
source: learnings/1789440138998-slang-rhi-vulkan-readbuffer-pooling-host-cached-my.md
---

# slang-rhi Vulkan readBuffer pooling: HOST_CACHED myth, fresh-device pooling proof, RAII handle

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789372793210-bom859
written_at: 2026-09-15T02:42:18.998Z
---

# slang-rhi Vulkan readBuffer pooling: HOST_CACHED myth, fresh-device pooling proof, RAII handle

From fixing shader-slang/slang-rhi#862 (route Vulkan `readBuffer` through the pooled `m_readbackHeap` StagingHeap instead of a transient per-call staging buffer). Non-obvious facts, all source-verified at HEAD e17f6d7:

- **StagingHeap ReadBack pages are NOT HOST_CACHED.** `StagingHeap::allocPage` (src/staging-heap.cpp) creates pages via `device->createBuffer` with `memoryType=ReadBack`, which goes through `BufferImpl::createBuffer` (src/vulkan/vk-buffer.cpp:414-416) requesting only `HOST_VISIBLE | HOST_COHERENT`. The `HOST_CACHED` flags at vk-heap.cpp:38-40 are the *separate* `IHeap`/`HeapImpl` path, which StagingHeap does NOT use. Don't claim HOST_CACHED / "faster CPU reads" for readback staging — a triage memo did, and it was wrong. (codex OUTPUT_REVIEW caught it.)

- **`StagingHeap::map(alloc, &ptr)` returns an offset-advanced pointer** (`page->getMapped() + offset`, staging-heap.cpp:181). `Allocation/Handle::getOffset()` is only the destination offset for `copyBuffer`. So after map you `memcpy` directly from the returned pointer — no manual offset math. (Mirror `Device::readTexture`, device.cpp:919-963.)

- **`StagingHeap::free()` retains one empty *standard* page** (default 16 MiB) for reuse and frees oversized pages immediately (staging-heap.cpp:205-219). So after a readback: `getUsed()==0` but `getNumPages()>=1`.

- **To prove pooling in a GPU test, use a fresh device.** Cached devices (the default) carry retained pages, so `getNumPages()>=1` after a read does NOT distinguish pooled from the old transient impl. Use `GPU_TEST_CASE(name, Vulkan | DontCacheDevice)`; `StagingHeap::initialize()` does not pre-allocate pages, so a fresh device's heap starts at `getNumPages()==0 && getCapacity()==0`. Then `0 → 1 page` after the first read is a *definitive* discriminator (the transient impl never touches the heap). `getUnderlyingDevice(device)` (src/device.cpp) unwraps the debug layer to reach `m_readbackHeap` and to call the backend directly for arg-validation tests.

- **Use RAII `RefPtr<StagingHeap::Handle>` (allocHandle) for readback, not bare alloc/free.** Freeing only on the success path leaks the allocation on any post-alloc `SLANG_RETURN_ON_FAIL` (submit/waitOnHost/map), which trips `StagingHeap::release()`'s `m_totalUsed==0` assert at teardown. Note `Device::readTexture` itself still has this latent non-RAII leak.

- **Tooling:** slang-rhi pins clang-format **v20.1.7** (`.pre-commit-config.yaml`), but containers often only have clang-format-17 → `pip install --break-system-packages clang-format==20.1.7`. An ASCII-only pre-commit hook (`tools/check_ascii_hook.py`) runs on cpp/h. Configure without GLFW when `libxinerama-dev` is missing: `-DSLANG_RHI_BUILD_TESTS_WITH_GLFW=OFF -DSLANG_RHI_BUILD_EXAMPLES=OFF` (buffer tests unaffected).

- **Overflow-safe range check idiom:** never form `offset + size` (wraps). Validate `offset > desc.size` first, then `size > desc.size - offset`. `Offset`/`Size` are both `size_t` in slang-rhi.h.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789440138998-slang-rhi-vulkan-readbuffer-pooling-host-cached-my.md`_
