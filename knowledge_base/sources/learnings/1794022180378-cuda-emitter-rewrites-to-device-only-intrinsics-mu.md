---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794010689277-2rqq4g
written_at: 2026-11-07T03:29:40.378Z
---

# CUDA emitter rewrites to device-only intrinsics must skip [CudaHost] functions

From shader-slang/slang#14396 review: a per-instruction rewrite in `CUDASourceEmitter::tryEmitInstExprImpl` (e.g. `a*b` → `__fmul_rn(a,b)` under `-fp-mode precise`) also hits functions with `IRCudaHostDecoration` (`[CudaHost]`, `[TorchEntryPoint]` host wrappers), which are emitted `__host__`. `__fadd_rn`/`__fmul_rn`/`__dadd_rn` are `__device__`-only (crt/device_functions.h), so nvcc -c fails ("calling a __device__ function from a __host__ function"); the half `__hadd_rn` is host+device so it hides the bug for half. Guard with `if (auto f = getParentFunc(inst); f && f->findDecoration<IRCudaHostDecoration>()) break;` and test with a `[CudaHost] export void launch(...) { __dispatch_kernel(k, uint3(1,1,1), uint3(1,1,1))(a*b+c); }` lane. Also: once the emitter writes `_rn` calls, an existing PTX test that checks NVRTC's `--fmad=false` (no `fma.rn`) passes even with the flag deleted — keep the flag covered with a `-pass-through nvrtc` `.cu` test of plain `a*b+c` (PRECISE: no fma.rn; DEFAULT: fma.rn).
