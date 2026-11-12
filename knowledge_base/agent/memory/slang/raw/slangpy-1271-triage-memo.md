---
type: triage
title: "slangpy#1271 — scalar vs float3 tensor perf gap; numpy → float3 Tensor"
description: "Question + docs defect + latent bug + perf finding, triaged 2026-11-11 on L40S. The reporter's gap is first-call compile in the mean (order-dependent). The real GPU gap is the generated kernel's default [numthreads(32)], not index math. from_numpy(plain arr, target_slang_dtype='float3') silently builds an under-sized tensor. The docs example view(dtype=) does not exist."
tags: [functional-API, codegen, generator, thread-group-size, performance, from_numpy, target_slang_dtype, docs, tensor]
resource: /workspace/agent/repro-1271/
---

# Triage: shader-slang/slangpy#1271 — Difference in performance between operations using tensors with scalar vs vector types

Date: 2026-11-11 | question (+ docs defect, latent bug, perf enhancement) | Severity medium (latent bug), low (question) | P2 | functional-API codegen + nanobind-bindings (from_numpy) + docs | cross-backend (measured Vulkan + CUDA, L40S) | Upstream-Slang: no

Reporter: manurare (external), slangpy 0.43.1, Vulkan. Filed 12:24Z; no comments or labels at triage time.

## What's broken / being requested
1. Is the perf gap expected? The reporter compares `addfloat(int2, ITensor<float,2>, IWTensor<float,2>)` on grid (N,3) with `addfloat3(int, ITensor<float3,1>, …)` on grid (N,), timing with `time.time()` and no sync.
2. How do you make a float3-element Tensor from a numpy (N,3) float32 array?

## Repro
All scripts and logs are in `/workspace/agent/repro-1271/`. The venv is `tmp/venv-1271`, with pip `slangpy==0.43.1`. Run from `/tmp`: `…/venv-1271/bin/python /workspace/agent/repro-1271/<script>.py vulkan|cuda`.
- `reporter.py` / `reporter_swapped.py`: the reporter's loop. It shows the 1000-iteration mean is dominated by first-call compile (Vulkan 133 ms vs 109 ms; CUDA 320 ms vs 265 ms). **Swapping the call order flips the verdict**: scalar mean 159 µs vs vec 178 µs. With the first call excluded, or using medians, the times are equal (Vulkan 63/61 µs, CUDA 44/42 µs).
- `bench.py` (warm; submit / call+sync / GPU timestamps; run twice and consistent). GPU time, scalar S2 vs float3 V1: 200k 17.4 vs 10.2 µs; 2M 118.8 vs 44.0 µs; 20M 1132 vs 747 µs. Vulkan and CUDA are the same. The submit cost does not differ.
- `raw.py` / `rawn.py` with `raw.slang` (numthreads 256) and `raw32.slang` (numthreads 32). Hand-written kernels at 256 show no scalar/float3 difference: 20M is 735 vs 738 µs, at about 650 GB/s, which is DRAM-bound. **At 32 they reproduce SlangPy exactly**: 1132.5 / 747.5 µs at 20M and 118.8 / 44.0 µs at 2M. So SlangPy's per-thread index math costs about 0. The whole gap comes from the group size: 32-thread groups cap occupancy, and 4-byte-per-thread loads cannot keep enough bytes in flight. This is a hypothesis about the hardware mechanism (block-per-SM limit). The group-size causation is measured.
- `cgs.py`: `module.addfloat.call_group_shape(Shape((64,3)))` brings S2 to 745 µs at 20M and 34.8 µs at 2M, which is faster than the default float3 path. Results are correct on both backends.
- `gridcpu.py`: CPU side only. `spy.grid` calls cost about 47 µs (Vulkan) / 25 µs (CUDA) with the grid reused, against 25 / 12 µs for element-wise calls. Building `spy.grid(shape)` per call adds about 17 µs more. `GridArgMarshall` is a Python marshall (`slangpy/experimental/gridarg.py:58-85`). This was observed only; no action taken.
- `dtype.py` / `dtype_c.py`: four routes to a float3 tensor, checked on Vulkan and CUDA (see the digest).

## Codebase digest (origin/main 639a016d; unchanged in these lines since v0.43.1 except the dispatch-groups clamp)
- `slangpy/core/generator.py:481`: `dispatch_thread_group_size = call_group_size if call_group_size != 1 else 32`. `:785-787` emits `[numthreads(32, 1, 1)]` when there is no call group (docstring `:769`). The raw dispatch default is `slangpy/core/dispatchdata.py:124` (`uint3(32,1,1)`). Origin: #995 (`32f9834a`, 2026-05-26).
- The C++ side is already parameterized: `dispatch_thread_count_from_total_threads(device, thread_group_size, total)` (`src/slangpy_ext/utils/slangpy.cpp:90-127`) uses the reflected group size.
- `FunctionNode.thread_group_size(uint3)` exists (`slangpy/core/function.py:244-249`), but its docstring says "only used for raw dispatch". It could be the opt-in knob for the functional path.
- `tensor_from_numpy` is at `src/slangpy_ext/func/tensor.cpp:470-579`. The structured branch checks `item_size != slang_stride` (`:518`). **The plain branch (`:532-545`) does not.** `buffer_desc.struct_size = item_size` (`:551`) and the strides are in numpy-itemsize units (`:559-568`). As a result, `from_numpy(f32 (N,3), target_slang_dtype="float3")` gives shape (N,3) float3, element_count 3N, on a 12N-byte buffer. `to_numpy()` returns (N,3,3) = 36N bytes. A kernel reading past the buffer silently gets zeros on Vulkan.
- `tensor_from_torch` (`tensor.cpp:581-649`, fold logic `:590-622`) consumes the last dim when `stride % scalar_size == 0` and `last_dim == stride/scalar_size`. This is the precedent for folding.
- Docs: `docs/src/tensors/python.rst:505-515` shows `float_tensor.view(shape=(10, 10), dtype="float3")`. **`view` has no `dtype`** (binding `tensor.cpp:775`, `Tensor::view` `src/sgl/func/tensor.cpp:437`), so it raises TypeError on 0.43.1 (added by #697, `047a7e34`). `target_slang_dtype` is undocumented: no docstring, and `python.rst:61-72` omits it. Its only tests use structs (`slangpy/tests/slangpy_tests/test_structured_numpy.py`). `python.rst:519-520` already says vector dtypes are "generally preferred".

## Working answers for the reporter (verified on L40S Vulkan + CUDA, 0.43.1)
- (a) Pass the (N,3) float tensor to a `float3`-parameter function, e.g. `float3 addf3(float3 a)`. SlangPy maps the trailing dim to float3: N threads, float3 GPU speed, ~25 µs submit, no grid. This needs element-wise style, not `ITensor<float3,1>`.
- (b) `t = spy.Tensor.empty(device, shape=(N,), dtype="float3"); t.copy_from_numpy(arr)`.
- (c) `spy.Tensor.from_numpy(device, arr.view(np.dtype([("x",f4),("y",f4),("z",f4)])).reshape(N), target_slang_dtype="float3")`.
- Avoid: `from_numpy(arr, target_slang_dtype="float3")` on plain (N,3) (silent wrong shape), and the docs `view(dtype=)` (TypeError).
- Perf knob today: `.call_group_shape(Shape((64,3)))` (or `(256,)` for 1-D).

## Candidate approaches
### Thread 1 — from_numpy plain-dtype validation (actionable bug)
- **A1 Validate (recommended).** In `tensor.cpp:532-545`, when `target_slang_dtype` is given and `dtype->buffer_layout()->stride() != item_size`, raise ValueError. The hint names `Tensor.empty(...).copy_from_numpy` and the structured view. Delta: the silent mis-shape becomes an error. Tradeoffs: tiny, and no valid use breaks (the current output is never correct). Risk: low; keep same-size reinterprets working (float32→"float", int32→"int").
- **A2 Fold the trailing dim like from_torch.** When `stride % item_size == 0`, `k = stride/item_size > 1`, `shape[-1] == k` and the last stride equals item_size, drop the last dim. Otherwise error as in A1. Tradeoffs: exactly what the reporter asked for, and gives API parity with from_torch. Risk: an API-design call. Padded layouts (Metal/CUDA half3, WGSL) give stride ≠ k·item_size, so they must error (or pad like `copy_from_numpy` `tensor.cpp:231-253`). Gate on a maintainer OK.
### Thread 2 — docs (actionable)
- Fix `python.rst:505-515`: replace `view(dtype=)` with routes (a)/(b)/(c). Document `target_slang_dtype` in `python.rst:61-72` and the binding docstring. Optionally add a short "benchmarking: warm up + wait_for_idle / timestamps" note and the `call_group_shape` perf knob.
### Thread 3 — default thread-group size (perf; PARKED for maintainer direction)
- **C1** Raise the default from 32 to 128/256 at `generator.py:481,787` (+`:769` docstring, `dispatchdata.py:124`). Measured win: 1.5× DRAM-bound and 3.4× L2-resident for scalar element-wise kernels. Risks: backend caps (WGSL 256, Metal per-pipeline max), tail waste on tiny dispatches, register-heavy kernels. Needs a sweep across samples and backends.
- **C2** Extend `FunctionNode.thread_group_size` (`function.py:244`) to the functional path when no call group is set. Opt-in, low blast radius, and can combine with C1.
- **C3** Docs only (point users at `call_group_shape`).
- Related: #806 (measured that the index math inlines; this run shows its GPU cost is ~0 on L40S, so a "contiguous fast-path" would buy nothing; the group size is the lever).

## Recommended path
Hand slangpy-fixer **A1 + Thread 2 docs**, with a regression test in `slangpy/tests/` (plain (N,3) f32 + `target_slang_dtype="float3"` raises; same-size reinterpret still works). The PR must say **`Refs #1271`, not `Fixes`**: the perf thread and the A2 decision stay open. Park C1/C2 on the issue for a maintainer (owner unassigned; propose ccummingsNV / szihs as the #806 assignee).

## Sources
- DeepWiki Q1 (per-thread work): confirms the init_thread_local_call_shape_info / Context / strided-load pipeline and cites the `python.rst` guidance.
- DeepWiki Q2: says `view(shape, dtype="float3")` is the documented route. **Verified false** (TypeError; no dtype param). Docs bug.
- Dedup: none. Searches covered from_numpy float3, target_slang_dtype, tensor view dtype, grid performance, vector dtype numpy. Related: #806, #163 (to_numpy size vs stride, draft PR #1222), #907 (structured numpy, introduced target_slang_dtype).
- Recall: shared wiki — SlangPy dispatch has no backpressure (no-sync loops measure submission); µs benchmark method from #1234.
