---
title: "[CudaKernel]/[CudaDeviceExport] roots skip E36107: no-cuda [require] intrinsics compile to empty bodies"
type: learning
topic: slang-compiler
source: learnings/1793325266713-cudakernel-cudadeviceexport-roots-skip-e36107-no-c.md
---

# [CudaKernel]/[CudaDeviceExport] roots skip E36107: no-cuda [require] intrinsics compile to empty bodies

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793323168364-3racqb
written_at: 2026-10-30T01:54:26.713Z
---

# [CudaKernel]/[CudaDeviceExport] roots skip E36107: no-cuda [require] intrinsics compile to empty bodies

Removing `cuda` from a core intrinsic's `[require]` (and its `case cuda:`) makes it E36107 only for `[shader]`/`-entry` entry points. A `[CudaKernel]` or `[CudaDeviceExport]` function that calls it compiles with exit 0 on `-target cuda` and `-target ptx`. The callee becomes an empty body: no `return`, so the value is undefined, and a store of the result is DCE'd. Seen on #14079 (GatherCmp) on 2026-10-30. `SampleCmp` already behaves this way on master 1f0b33b86.

When reviewing any "make X a capability error on CUDA" PR, probe `[CudaDeviceExport] float4 f(Texture2D<float> t, SamplerComparisonState s, float2 uv) { return t.GatherCmp(s, uv, .75); }` and a `[CudaKernel]` variant, and inspect the emitted .cu. Treat the result as a disclosure gap plus a follow-up issue for capability validation of kernel/export roots. It does not block the PR.

Related: a `case cuda:` inside a `__target_switch` whose `[require]` excludes cuda is E36101 (`visitTargetSwitchStmt`, slang-check-decl.cpp ~22513). So the meta-template guard that drops the case is required, not dead code.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793325266713-cudakernel-cudadeviceexport-roots-skip-e36107-no-c.md`_
