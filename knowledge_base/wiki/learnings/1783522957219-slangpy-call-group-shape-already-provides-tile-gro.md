---
title: "slangpy call_group_shape already provides tile/groupshared dispatch (issue #844)"
type: learning
topic: slang-compiler
source: learnings/1783522957219-slangpy-call-group-shape-already-provides-tile-gro.md
---

# slangpy call_group_shape already provides tile/groupshared dispatch (issue #844)

When triaging slangpy requests for "configurable thread group size / [numthreads] / 2D tile dispatch / groupshared cooperative kernels" (e.g. issue #844, slangtorch launchRaw parity), check HEAD first — most of it is ALREADY implemented on the normal (non-`.dispatch()`) call path:

- **`FunctionNode.call_group_shape(shape: Shape)`** (`slangpy/core/function.py:374`) is the public API. It drives `[numthreads(call_group_size,1,1)]` codegen at `slangpy/core/generator.py:769-772` (the "internal 32,1,1" is only the *default* when no group shape is set — it IS overridable).
- Generated `compute_main` exposes `SV_DispatchThreadID` + `SV_GroupID` + `SV_GroupIndex` (generator.py:773-786); user Slang accesses them via `CallShapeInfo.get_call_id()/get_call_group_id()/get_call_group_thread_id()` in `slangpy/slang/callshape.slang:74-110`. Mapping `call_id[i] = call_group_id[i]*group_shape[i] + call_group_thread_id[i]` — one tile maps to exactly one thread group, so `groupshared` cooperative code is correct WHEN `call_group_shape` is set.
- Raw-dispatch path has a separate `FunctionNode.thread_group_size(uint3)` (function.py:244) — "currently only used for raw dispatch."
- Tests: `test_call_groups.py`, `test_call_group_integrations.py`.

Footgun: hand-writing `groupshared` tile code WITHOUT setting `call_group_shape` gives silent shared-memory corruption (default 32,1,1 packs unrelated elements per group). Not a bug — a missing-API-usage.

Related: `.dispatch()` + torch.Tensor (issue #832) ERRORS cleanly (ValueError "Unsupported type" at bind time, before GPU work) — it is NOT silent corruption. Root cause is a lazy-init gap: `DispatchData` (dispatchdata.py) never imports/registers the torch marshall, unlike `CallData` which lazy-imports it at `calldata.py:178-184`. The native support (create_dispatchdata, write_raw_dispatch_data) already exists — a ~5-line mirror would fix #832. BUT maintainer mkeshavaNV directed NOT to add features to `.dispatch()`: it is slated for removal, gated on #768 (raw-dispatch redesign, largely landed on HEAD via the `_thread_count` kwarg for dim-0 kernels).

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783522957219-slangpy-call-group-shape-already-provides-tile-gro.md`_
