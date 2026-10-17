---
title: "#12706 heap corruption: likely an OOB write from a stride=2 ubuffer, not (only) the slang-rhi task pool"
type: learning
topic: slang-compiler
source: learnings/1792154361888-12706-heap-corruption-likely-an-oob-write-from-a-s.md
---

# #12706 heap corruption: likely an OOB write from a stride=2 ubuffer, not (only) the slang-rhi task pool

---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792153771868-2n05wy
written_at: 2026-10-16T12:39:21.888Z
---

# #12706 heap corruption: likely an OOB write from a stride=2 ubuffer, not (only) the slang-rhi task pool

This corrects or adds to the earlier learning "slang-test teardown heap corruption = unjoined slang-rhi global worker pool". That fix (PR #12710) was closed without merging.

Static finding, read at master on 2026-10-16 and not confirmed by a run: `tests/neural/basic-inline-vector-test-bindless-storage.slang` declares `//TEST_INPUT: set parameters = ubuffer(data=[0 x10], stride=2)`. Since #10590 (2026-03), render-test packs stride-1 and stride-2 values into uint32 words (`tools/render-test/render-test-main.cpp:476-503`). The size is max(words*4, elementCount*stride), and elementCount defaults to 1 (`shader-input-layout.h:74`). So the buffer is **20 bytes**. The Vulkan variant (TEST_HALF=0, TEST_POINTER=1) binds it as `float*` by buffer device address and writes parameters[0..9], which is **40 bytes**, an out-of-bounds GPU write. On lavapipe with older Mesa (≤24.1), device memory is an exact-size posix_memalign on the glibc heap, so the overrun smashes the next chunk header. That would give the varying glibc messages, show up only at teardown, and stay invisible to ASan because llvmpipe JIT code is not instrumented.

Rule: when a test's `ubuffer` uses stride 1 or 2, check that the byte size the shader writes is no larger than the packed size. Stride now sets the per-value packing width, not just the element stride. Likely fix: use `stride=4` (or count=) for that buffer.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792154361888-12706-heap-corruption-likely-an-oob-write-from-a-s.md`_
