---
title: "A shared vocabulary is not a shared code path — verify the second member calls the cited function"
type: learning
topic: ci-tooling
source: learnings/1786134256554-a-shared-vocabulary-is-not-a-shared-code-path-veri.md
---

# A shared vocabulary is not a shared code path — verify the second member calls the cited function

**Rule:** before escalating "N separate flake buckets share one root cause", grep for the cited
function in *each* bucket's actual code path. A shared vocabulary ("CUDA", "host-pinned", "interop",
"shared buffer") is not evidence of a shared component.

**The case (2026-08-07, shader-slang/slang CI babysitting):** I escalated that three flake buckets —
`cuMemAllocHost` → `CUDA_ERROR_ALREADY_MAPPED`, `texture-shared-cuda.vulkan` CHECK_GE, and
`sharedBufferVulkanToCUDA` — shared one defect in slang-rhi's CUDA page allocator
(`src/cuda/cuda-heap.cpp:395`). It was the first cross-bucket proposal in a week, so it got taken up
for escalation. **It was wrong.** One grep killed it:

- Shared-handle interop goes through `cuImportExternalMemory` / `cuExternalMemoryGetMappedBuffer`
  (`src/cuda/cuda-buffer.cpp:135,152`, `cuda-texture.cpp:548`) — it **never allocates host-pinned
  pages**, so it never reaches `cuda-heap.cpp` at all.
- The host-pinned heap is used only by `createBuffer` for non-`DeviceLocal` buffers
  (`cuda-buffer.cpp:88`) and the constant-buffer pool. `test-buffer-shared.cpp:29` sets
  `MemoryType::DeviceLocal` — the device branch.
- Two of the three buckets were **already filed** as slang-rhi#787 with an independently-diagnosed
  *different* cause (missing cross-API synchronization, not allocation). Re-escalating would have
  been a duplicate.

**Two further self-inflicted errors worth copying the detectors for:**

1. **I implied "page reuse / double-registration" without reading the control flow.**
   `cuMemAllocHost` is only reached on a cache **miss** — `m_pageCache.findReusable(...)` returns
   early (`cuda-heap.cpp:376-385`). A reused page never reaches the failing line. The error is on a
   *fresh* driver allocation, which points the opposite way (driver/host address-space contention,
   allocator as victim not culprit).
2. **I let a combined population's recurrence stand in for the one member I proposed a cause for.**
   Re-deriving ledger *membership* (not counts): the allocator signature had **2 rows**, and one of
   them (#12154) recorded no error code and its run is past log retention ⇒ **1 confirmed
   occurrence**, not "recurring across months". The two nominally-separate buckets also **overlapped
   on the same 2 PRs** — three buckets was really one, double-counted.

**How to apply:** the probe is cheap and specific — **name the second member and verify it calls the
cited function.** If you cannot show two buckets reaching the same file:line, you have one bucket and
a hypothesis, not a cross-bucket root cause. Also search the downstream repo's issue tracker before
escalating; a bucket already filed with a different diagnosis is a strong signal your unifying story
is wrong. And check whether debug-only error-attribution macros are compiled out (here
`SLANG_RHI_ENABLE_CUDA_SYNC_ERROR_CHECK 0`, `cuda-utils.h:19`) before claiming an error was
"inherited from a prior call" — if they're off, the failing call really did return the code.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1786134256554-a-shared-vocabulary-is-not-a-shared-code-path-veri.md`_
