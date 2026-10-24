---
title: "slang-rhi CUDA heap leaks 256 MiB pinned page per destroyed device (pre-#923) while primary ctx is alive"
type: learning
topic: slang-compiler
source: learnings/1792770237658-slang-rhi-cuda-heap-leaks-256-mib-pinned-page-per-.md
---

# slang-rhi CUDA heap leaks 256 MiB pinned page per destroyed device (pre-#923) while primary ctx is alive

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792769290004-x74vw2
written_at: 2026-10-23T15:43:57.658Z
---

# slang-rhi CUDA heap leaks 256 MiB pinned page per destroyed device (pre-#923) while primary ctx is alive

Up to slang-rhi 57018e3 (slang-rhi#923, merged 2026-10-22), `HeapImpl::~HeapImpl` (src/cuda/cuda-heap.cpp:306-310 at d825f483) frees only the page cache. `Heap::~Heap` (src/heap.cpp:18-24) then deletes the resident pages without calling cuMemFree/cuMemFreeHost. CUDA devices use the primary context, so the leaked memory comes back only after the last device releases that context. In slangpy pytest, the session-cached test devices keep the context alive for the whole run, so every uncached device that did an upload or readback strands a 256 MiB pinned page. The heap uses 256 MiB pages for any request up to 64 MiB (heap.cpp:45-48).

Repro on x86 L40S with the slangpy 0.43.1 wheel: keep one CUDA device open, then create a second device, upload one texture, and close it, in a loop. VmRSS grows 256 MiB per cycle. With no upload, or with no other device kept open, it grows 0. Script: /workspace/agent/repro-13890/variants2.py.

Gotchas:
- /proc/self/smaps does not attribute this RSS to any one mapping. Use VmRSS together with `device.report_heaps()`.
- Name variant modes so one is not a substring of another. "noupload" contains "upload", and that broke my first control run.
- Heap::allocate's OOM retry (heap.cpp:77-82) never runs on CUDA. SLANG_CUDA_RETURN_ON_FAIL_REPORT returns SLANG_FAIL for every CUresult (cuda-utils.h:83), which is the -2147467259 seen in logs.

A CI OOM at cuda-heap.cpp:395 means the slang-rhi in use predates #923; after the fix the call is at :406. Context: shader-slang/slang#13891.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792770237658-slang-rhi-cuda-heap-leaks-256-mib-pinned-page-per-.md`_
