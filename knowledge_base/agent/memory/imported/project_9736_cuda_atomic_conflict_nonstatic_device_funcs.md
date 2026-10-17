---
type: project
name: project-9736-cuda-atomic-conflict-nonstatic-device-funcs
description: "slang#9736 (P2, CUDA backend): prelude global atomic overloads collide with PyTorch ATen, and generated __device__ funcs get external linkage because CUDASourceEmitter skips the C++ path that emits static. Measured with nvcc 12.6, posted cmt 5176126183; recommended (b) internal linkage first. Assignee mkeshavaNV is unavailable (08-05); scrub posted; waits on a maintainer naming a new owner and an (a)/(b)/(c) call."
metadata:
  node_type: memory
  type: project
  originSessionId: 5998cff2-0986-4076-bf33-eb6d163a5534
---

# slang#9736: CUDA atomic conflicts + external-linkage generated device funcs

Filed 2026-01-26 by wilsonCernWq: they compile individual Slang functions to CUDA and `#include` them from an existing
CUDA/gsplat codebase alongside PyTorch. Subsystem **CUDA backend (prelude + emit)**, plus `-target cuh` completeness.
Not autodiff; autodiff only surfaces it through AnyValue marshalling. **P2**: no miscompile, but it hard-blocks the
`cuh` workflow, reproduces every time, and the only workaround is hand-editing the generated header after each build.

## The three defects (verified on master `b0e43d657d`, 08-05)

1. **Atomic overload collision.** `prelude/slang-cuda-prelude.h:2719/2724/2732/2739` defines `longlong` overloads of
   `atomicExch`, `atomicCAS`, `atomicAdd` and a `float atomicCAS` at global scope (`longlong` = `int64_t`, `:306`).
   ATen's `Atomic.cuh` has `inline __device__ void atomicAdd(int64_t*, int64_t)`, so nvcc reports "cannot overload
   functions distinguished by return type alone". The atomics are in no namespace (the prelude does have an unrelated
   `Slang_CUDA_WMMA` namespace at `:6649`).
2. **External linkage.** `slang-emit-cpp.cpp:993-996` emits `static` for any function where
   `isPublicOrExportedFunc` (`:956`) is false, but `CUDASourceEmitter::emitSimpleFuncImpl`
   (`slang-emit-cuda.cpp:1521-1525`) skips the C++ implementation and calls the C-like one, which emits no linkage.
   The same `.cuh` in two TUs then gives duplicate symbols.
3. **"ForceInline ignored."** The reporter's `unpackAnyValue8_0` is compiler-synthesized
   (`slang-ir-any-value-marshalling.cpp:1144-1154`) and gets no inline decoration, so users cannot fix it with
   `[ForceInline]`. Pass order is not the cause: force-inlining (`slang-emit.cpp:1698`) runs after marshalling (`:1659`).

## Measurements (slang-triager, nvcc 12.6, no GPU needed)

- Error 1 reproduces verbatim with an ATen-shaped `void atomicAdd` placed before the prelude.
- Error 2 A/B: `-target cpp` emits `static float Scale_eval_0`, `-target cuda` emits no specifier; two TUs give
  `nvlink error : Multiple definition of '_Z12Scale_eval_0P7Scale_0f'`.
- With `static` on the helpers and two modules with distinct entry points, multiple definitions drop from 2 to 0. An
  earlier "internal linkage is not sufficient" result was retracted: the harness duplicated one module, so both TUs
  defined the same entry point ([[feedback_a_counterfactual_is_only_as_good_as_its_harness]]). Entry points are meant
  to stay external (`kIROp_EntryPointDecoration` is in the allowlist).
- Two shapes already link today: `-target cuh` (declarations only) in N TUs plus one `-target cuda` definition TU with
  `-dc`; and header-only once every function has internal linkage. The remaining `Undefined reference to
  'SLANG_globalParams'` is pre-existing and supplied by the host; it is not this issue.

## Framing and options

`-target cuh` already exists (`slang-options.cpp:421`, `CodeGenTarget::CUDAHeader`, test
`tests/headers/generate-cuh-header.slang`), but its `#pragma once` only guards one TU. So this is an unfinished feature,
not a missing one.
- **(a)** Namespace or guard the prelude atomics. Precedent: the opt-in `SLANG_PRELUDE_NAMESPACE` (`slang-cpp-types.h:4-5`,
  emitted at `slang-emit-cpp.cpp:1915-1916`), already defined by `prelude/slang-torch-prelude.h:52`; the CUDA prelude
  has 0 uses. Potentially source-breaking, so design-gated.
- **(b)** Internal linkage for non-exported generated `__device__` functions, reusing `[CudaDeviceExport]`
  (`core.meta.slang:4803,4818`), which is already in the allowlist. Lowest risk, and the reference implementation exists.
- **(c)** Both, scoped to `-target cuh`.

Recommended (b) first.

## State and resume

- **08-04:** triager posted cmt `5176126183` (`reproduced` label, Type Bug).
- **08-05:** jkiviluoto-nv (cmt `5195816253`): mkeshavaNV "won't be returning to this work for a while", asked for a
  scrub. Scrub posted as `5197271885` plus correction `5197353299`. Still relevant at `b0e43d657d`; no competing PR
  (#12242 ended docs-only; #12182 and #12080 are adjacent).
- **Owner candidates** from REST commit history: prelude szihs (11), kaizhangNV (6); `slang-emit-cuda.cpp` csyonghe (6),
  kaizhangNV (4), szihs (4). kaizhangNV and szihs touch both files. No CODEOWNERS rule covers these paths.
- **Resume:** a non-bot comment on the issue from a maintainer naming a new owner and choosing (a)/(b)/(c). No fixer
  dispatched: it is design-gated and still human-assigned ([[project_8306_embed_core_glsl_module_slang_dll]] precedent).
- **Caveats:** the clone was shallow, so make no claim about when this regressed. The ATen signature was read from
  PyTorch `main`; the void-vs-`longlong` mechanism holds across versions, the line number may not.

## Lessons from this chain

- My first "repro not executed" was wrong: nvcc 12.6 was at `/usr/local/cuda/bin/nvcc` and `slangc` was in my own tree.
  I had guessed two relative paths from the wrong cwd ([[feedback_capability_negative_needs_a_search_not_two_guesses]]).
- A compound `OR` GitHub search returned a false zero ([[feedback_github_search_multi_or_query_returns_false_zero]]).
- A stale binary (`3649fb982`, 82 commits behind) was still a valid instrument for the linkage claim, because the diff
  touching `isPublicOrExportedFunc`/`static "` was empty. Check the discriminating diff instead of discarding the binary.
- Related: [[feedback_control_the_instrument_not_the_reasoning]].
