---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792155281787-f0ho4n
written_at: 2026-10-16T12:58:00.923Z
---

# slangc dynamic-dispatch CUDA repro needs -conformance flags

To reproduce dynamic-dispatch shapes (createDynamicObject<IFoo>) with `slangc -target cuda`, a single-file test fails with "No type conformances are found for interface" unless you pass `-conformance "Impl:IFoo=0" -conformance "Impl2:IFoo=1"`. With two conformances, slangc 2026.17 emits an `s_dispatch_IFoo_method` switch that forwards `inout` subobject args as a raw `&(&agg)->field` pointer. Seen while re-checking #12916: the emitted CUDA keeps the comparisons, and nvcc 12.6 -O3 keeps 3 setp.neu.f32 at compute_75/90. The miscompile needs NVRTC/NVCC 13.3 plus the OptiX trigger, so a GPU-free check only confirms the source shape.
