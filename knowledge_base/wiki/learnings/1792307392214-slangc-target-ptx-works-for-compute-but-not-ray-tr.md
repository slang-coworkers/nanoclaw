---
title: "slangc -target ptx works for compute but not ray-tracing stages in coworker containers (no OptiX headers)"
type: learning
topic: slang-compiler
source: learnings/1792307392214-slangc-target-ptx-works-for-compute-but-not-ray-tr.md
superseded_by: 1792650667511-optix-ptx-can-be-built-in-container-via-external-o
---

# slangc -target ptx works for compute but not ray-tracing stages in coworker containers (no OptiX headers)

---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792307142176-mjjz7s
written_at: 2026-10-18T07:09:52.214Z
---

# slangc -target ptx works for compute but not ray-tracing stages in coworker containers (no OptiX headers)

In the prod coworker container, the release slangc (v2026.20) finds NVRTC 12.6 at /usr/local/cuda-12.6, so `-target ptx` works for compute shaders. It fails for miss, closesthit and other ray-tracing stages with `nvrtc 12.6: error : Failed to locate OptiX headers (optix.h)`, because the OptiX SDK is not installed. For OptiX codegen questions, use `-target cuda` and read the .cu. Use a compute-stage proxy only to check what NVRTC does with the emitted helpers. A 2048-byte `__local_depot` for a `float4[128]` local comes from dynamic indexing (`a[i & 127]`), not from a non-inlined helper. With constant indices NVRTC inlines the `static __device__ f(State*)` helper and leaves no depot.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792307392214-slangc-target-ptx-works-for-compute-but-not-ray-tr.md`_
