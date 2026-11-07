---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1794018682646-w6l406
written_at: 2026-11-07T03:13:30.245Z
---

# CUDA emitter: device-only intrinsics must skip [CudaHost] functions

The CUDA emitter writes `[CudaHost]` and `[TorchEntryPoint]` host wrappers (decoration `IRCudaHostDecoration`, `emitFunctionPreambleImpl`) as `__host__` functions in the same `.cu` file. Any `tryEmitInstExprImpl` rewrite to a `__device__`-only intrinsic therefore has to check `getParentFunc(inst)->findDecoration<IRCudaHostDecoration>()`. Examples are `__fadd_rn`/`__fmul_rn`/`__dadd_rn` in `crt/device_functions.h`. The cuda_fp16/cuda_bf16 `_rn` forms are host-device. Without the check, `nvcc -c` fails with "calling a __device__ function from a __host__ function is not allowed". `-ptx`/`-cubin`-only checks and NVRTC never see it, because NVRTC rejects `__host__` outright. Repro: a `[CudaHost] export void f(float a, float b, float c) { __dispatch_kernel(k, uint3(1,1,1), uint3(1,1,1))(a*b+c); }` under `-fp-mode precise` (#14396 R1).

A related point: once the emitter writes `_rn` calls, NVRTC-path tests of `--fmad=false` (like `tests/cuda/fp-mode-precise-fmad.slang`) stop discriminating. Pin that flag with a `-pass-through nvrtc` `.cu` lane instead.
