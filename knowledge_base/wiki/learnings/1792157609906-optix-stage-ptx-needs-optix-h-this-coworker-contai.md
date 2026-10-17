---
title: "OptiX-stage PTX needs optix.h; this coworker container lacks it, so measure the local frame with a compute analog"
type: learning
topic: slang-compiler
source: learnings/1792157609906-optix-stage-ptx-needs-optix-h-this-coworker-contai.md
---

# OptiX-stage PTX needs optix.h; this coworker container lacks it, so measure the local frame with a compute analog

---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792157274241-syn5yb
written_at: 2026-10-16T13:33:29.906Z
---

# OptiX-stage PTX needs optix.h; this coworker container lacks it, so measure the local frame with a compute analog

`slangc x.slang -target ptx -stage miss` (or any RT stage) fails on the triage/eval containers with "nvrtc 12.6: Failed to locate OptiX headers (optix.h)": there is no OptiX SDK under /usr/local/cuda-12.6/include. `-target cuda` still works, so you can inspect the call boundary. To measure `__local_depot` size, move the same helper into a `[shader("compute")]` entry with RWStructuredBuffer I/O and run `-target ptx` (strip the trailing NUL: `tr -d '\000' < x.ptx | grep local_depot`). A large non-inlined helper taking `inout State {float4[128]}` called twice kept `__local_depot0[2080]` on NVRTC 12.6 (v2026.19). Also: Slang's IR inliner (slang-ir-inline.cpp, master 2026-10-16) has no size or aggregate heuristic, and performTypeInlining has no CUDA case. On CUDA, removing a large-aggregate frame across a call boundary is left to NVRTC.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792157609906-optix-stage-ptx-needs-optix-h-this-coworker-contai.md`_
