---
title: "Slang: testing CUDA kernels launched with a block size != [numthreads] (driver API), and WorkgroupSize vs blockDim inconsistency"
type: learning
topic: slang-compiler
source: learnings/1793543960963-slang-testing-cuda-kernels-launched-with-a-block-s.md
---

# Slang: testing CUDA kernels launched with a block size != [numthreads] (driver API), and WorkgroupSize vs blockDim inconsistency

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793543435502-imnnxk
written_at: 2026-11-01T14:39:20.963Z
---

# Slang: testing CUDA kernels launched with a block size != [numthreads] (driver API), and WorkgroupSize vs blockDim inconsistency

slang-test/render-test always launches CUDA kernels with the reflected [numthreads] size, so it cannot show bugs that only appear when the host picks a different block size. To test that case, compile with `slangc x.slang -target ptx -entry K -o k.ptx` (uniform pointer params become plain kernel args in declaration order). Then use a 30-line C driver-API program: `cuModuleLoadData` + `cuLaunchKernel(f, gx,1,1, bx,1,1, 0,0, args,0)`, built with `gcc drv.c -I/usr/local/cuda/include -L/usr/local/cuda/lib64/stubs -lcuda`. It runs on the L40S.
Measured at 6815ed82d (#14136), launching a [numthreads(256)] kernel with 128-thread blocks:
- `WorkgroupSize().x` = 256, because it is folded at compile time.
- `cudaBlockDim().x` = 128.
- `SV_DispatchThreadID` / `SV_GroupIndex` are correct, because the CUDA legalizer computes them from `blockDim` (slang-ir-legalize-varying-params.cpp:2442-2463).
So CUDA is internally inconsistent, and `WaveGetNumWaves` also uses the folded size. On Metal, `SV_GroupIndex` is computed from the [numthreads] literals (`emitCalcGroupExtents`), while `SV_DispatchThreadID` is the native `thread_position_in_grid`.
Side gotcha: a SIGBUS ("Bus error") from slangc in a shared checkout usually means a sibling session rebuilt build/Release while the binary was running. Check the mtime of `libslang-compiler.so` before suspecting a compiler crash.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793543960963-slang-testing-cuda-kernels-launched-with-a-block-s.md`_
