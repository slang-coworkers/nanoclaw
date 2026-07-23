---
title: "groupshared param by-ref regresses CUDA emit (vk-only inline pass masks it)"
type: learning
topic: misc
source: learnings/1784741954379-groupshared-param-by-ref-regresses-cuda-emit-vk-on.md
---

# groupshared param by-ref regresses CUDA emit (vk-only inline pass masks it)

When a change makes `groupshared` parameters pass **by reference** (Slang #10641 / PR #11709), watch the CUDA target specifically:

- The neural stdlib intrinsic `getSharedBaseAddr` in `source/standard-modules/neural/shared-memory-pool.slang` does `__intrinsic_asm "...__cvta_generic_to_shared(($0).m_data)"`, which assumes `$0` (a `groupshared uint4[V]` param) arrives **by value**. Passed by reference, `$0` becomes `&data`, so CUDA emits `((&data_0)).m_data` — `.m_data` on a pointer — and **nvrtc rejects it**: `expression must have class type but it has type "FixedArray<uint4,N> *"`.

- **Why SPIR-V/`vk` variants stay green but CUDA breaks:** the groupshared-by-ref *inlining* lives only in `GLSLResourceReturnFunctionInliningPass` (`slang-ir-inline.cpp`), i.e. Khronos targets. It inlines the callee so the by-ref param disappears. CUDA has no equivalent inline pass, and the emit-side unwrap for a by-ref groupshared param was added only to `slang-emit-hlsl.cpp` (`emitSimpleFuncParamImpl`) — `slang-emit-cuda.cpp` has none. So the by-ref groupshared param survives to CUDA emit and produces malformed C++.

Lesson for any emit/lowering change touching a param-passing convention: a green SPIR-V/HLSL run does **not** clear CUDA. The `test-linux-release-gcc-x86_64-sm80 / test-slang` job runs `tests/neural/` + `tests/cooperative-matrix/` on **CUDA (nvrtc) + Vulkan**; those neural CUDA tests are the canary for groupshared/coopmat emit regressions. Grep the neural/coopmat stdlib for `__intrinsic_asm` bodies that dereference `$0` with `.member` before changing how any param is passed.

Also: a `test-slang` GPU job that runs ~65s with `steps: []` (no failing step recorded) is a GPU-priority-yield/setup abort, NOT a real test failure — distinguish from a run that executes for minutes and lists `FAILED test:` lines. And a Falcor red whose check-run annotation says "self-hosted runner lost communication with the server" is an infra dropout, re-runnable, not code.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1784741954379-groupshared-param-by-ref-regresses-cuda-emit-vk-on.md`_
