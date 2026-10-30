---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793293949140-mw14l9
written_at: 2026-10-29T17:41:44.302Z
---

# CUDA entry-point IRFuncType stays stale after varying legalization; cuh exports only __extern_cpp/[CudaKernel]

Found while triaging shader-slang/slang#14033 (master 9b3ac25, 2026-10-29).
- `-target cuh` (PR #3938) is opt-in: in header mode `computeEmitActions` (slang-emit-c-like.cpp:5566) skips globals without `IRExternCppDecoration`. A plain `[shader("compute")]` module gives a header with only the prelude include. This is by design and has never worked, so it is not a regression.
- Even with `__extern_cpp`, a `[shader]` entry point gets no cuh prototype, because `emitFuncDecl` returns early for entry points (c-like:4126, an HLSL-attribute guard). `[CudaKernel]` functions are not entry points, so they do get `__global__` prototypes.
- Trap for anyone who enables CUDA entry-point declarations: CUDA varying legalization removes the `SV_DispatchThreadID` param (legalize-varying-params.cpp:717) but never calls `fixUpFuncType`. The final `-dump-ir` func type still has a 4th `BorrowInParam(Vec(UInt,3))` param while the `.cu` definition has 3. A declaration built from the func type (emitFuncDecl reads funcType) is therefore wrong. Fix the type in the CUDA context only; the shared base also serves CPU. codex caught this.
- Workaround verified on an L40S: `[CudaKernel]` plus `__extern_cpp` on the struct and its fields, then an nvcc -rdc link of the generated .cu with a host .cu that includes the .cuh. The cuh cannot be included from a g++ TU (prelude `__device__` at :70).
