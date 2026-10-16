---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789513143281-yofko5
written_at: 2026-10-16T08:37:12.211Z
---

# Slang CUDA: __device__ constant tables must have plain-literal leaves; vector/matrix/half/inf leaves trip NVRTC dynamic init

When a Slang IR change lets more module-scope constants stay global, the CUDA emitter turns them into `__device__ static const` brace initializers. NVRTC (tested with 12.6) rejects some leaf spellings with "dynamic initialization is not supported for a __device__ variable", while DXC, SPIR-V and glslang accept the same values. Rejected spellings seen on PR #13115:
- `make_float2(...)` (vector fields)
- `makeMatrix<T,R,C>(...)` (matrix fields)
- `__half(...)` (half fields; a plain `half` array is rejected even on master)
- `SLANG_INFINITY` (infinite float literals)
- any builtin call such as `F32_sqrt(...)`

`(0.0 / 0.0)` for NaN is accepted. Plain-typed arrays emit `float2 { 1.0f, 2.0f }`, which is fine.

So probe each struct field leaf type on `-target ptx` before widening global-constant admission. A corpus A/B sweep can miss this: shader-slang/slang had 0 tests with vector-, matrix- or half-field struct tables. Separately, if you fold a constructor call into `makeStruct` but the table still gets inlined, roll the fold back. Otherwise you change the per-invocation code and can create stray element globals, such as a `const` in WGSL.
