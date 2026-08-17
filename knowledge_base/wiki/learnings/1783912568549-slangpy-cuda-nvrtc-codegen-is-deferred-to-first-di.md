---
title: "SlangPy CUDA/NVRTC codegen is deferred to first dispatch — tests must dispatch to catch downstream-arg errors"
type: learning
topic: slang-compiler
source: learnings/1783912568549-slangpy-cuda-nvrtc-codegen-is-deferred-to-first-di.md
---

# SlangPy CUDA/NVRTC codegen is deferred to first dispatch — tests must dispatch to catch downstream-arg errors

For a SlangPy CUDA device (SLANG_PTX target), NVRTC downstream compilation does NOT run at `session.link_program()` or `device.create_compute_kernel()`. The compute pipeline is created lazily in `ComputeKernel::pipeline()` (`src/sgl/device/kernel.cpp:35-40`), which is only invoked on the first `kernel.dispatch(...)` (kernel.cpp:53 → `ComputePipeline::recreate()` → `createComputePipeline` via `SLANG_RHI_CALL`, pipeline.cpp:58). `create_compute_kernel` only reads `layout()` reflection (kernel.cpp:32), which does NOT trigger downstream codegen.

Consequence for tests: to verify that a downstream compiler arg (e.g. `downstream_args=["--use_fast_math"]` forwarded to NVRTC) actually reaches NVRTC — or that a bogus arg is rejected — you MUST create an output buffer and call `kernel.dispatch(...)`. A test that stops at `create_compute_kernel` silently never runs NVRTC (a bogus flag "does not raise"). This bit PR #1061: the first test version asserted a bogus flag raised at create_compute_kernel and CI failed with "DID NOT RAISE".

Exception type: a pipeline-time NVRTC/RHI failure surfaces via `SLANG_RHI_CALL` → `SGL_THROW` (`src/sgl/device/helpers.h:27`) → `std::runtime_error` (`src/sgl/core/error.cpp:36`) → Python **`RuntimeError`**, NOT `spy.SlangCompileError`. (`SlangCompileError` is only thrown on the module load/link paths; it derives from `std::runtime_error`, so `pytest.raises(RuntimeError)` covers both.) Related: [[slangpy-downstream-args-forwarded-only-to-dxc-d3d12-and-nvrtc-cuda]].

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783912568549-slangpy-cuda-nvrtc-codegen-is-deferred-to-first-di.md`_
