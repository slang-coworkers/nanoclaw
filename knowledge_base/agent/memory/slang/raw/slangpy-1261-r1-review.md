# Review: shader-slang/slangpy#1261 — Support torch.bfloat16 tensors in the torch bridge

- **Head:** `4d0592d0` (base main `68d1e782`, Slang 2026.20)
- **Mode:** pr (round 1)
- **Verdict:** REQUEST_CHANGES

## Summary

The product change is correct and complete for tensors. `ScalarType.bfloat16` and `DataType.bfloat16` are added. Every C++ switch on the torch and tensor paths handles them. The fallback `<V2` → `<i2` + `.view(dtype)` fix is sound. On an L40S (Linux, CUDA and Vulkan, native and fallback bridge), all 17 new tests pass. On a main build, all 17 fail.

One blocker: **CI is red on Windows.** `test_bfloat16_tensor_write[native|fallback-vulkan]` fails in both Windows jobs (Debug and Release). The test assumes the GPU rounds float→BFloat16 to nearest-even. The Windows runner's Vulkan driver rounds toward zero. The fix is a small test change.

## Bugs

### B1 (must-change): `test_bfloat16_tensor_write` is not portable on Vulkan, and Windows CI fails

`slangpy/tests/slangpy_tests/test_torchintegration.py:1590-1595`

- **CI evidence.** Run 41948449555 has 2 failures in each Windows job: Release job 126986359893 and Debug job 126986359901. Both report `2 failed, 6316 passed`. The failures are `test_bfloat16_tensor_write[native-DeviceType.vulkan]` and `[fallback-DeviceType.vulkan]`.
- **Values.** The kernel wrote `[-2.0, -1.7266, -1.4609, -1.1953, -0.9297, …]`. The test expected `src.to(torch.bfloat16)`, which is `[-2.0, -1.7344, -1.4688, -1.2031, -0.9336, …]`.
- **Root cause (verified).** The Windows output is bit-identical to round-toward-zero, i.e. dropping the low 16 bits of the float32 (`(src.view(int32) & ~0xFFFF)`). It is not round-to-nearest-even. Vulkan leaves the rounding of a narrowing `OpFConvert` to the implementation, so a driver may truncate. The L40S on Linux (driver 595) and CUDA (`__float2bfloat16`) both round to nearest-even, which is why the local results are green.
- **What is not broken.** The binding and the copy paths work on Windows. The values arrive, and only the last bit of the rounding differs. `test_bfloat16_tensor_read` (bf16→float is exact) passes there.
- **Fix.** Use inputs that bfloat16 represents exactly, so the result is the same under any rounding mode. For example, `src = torch.linspace(-2.0, 2.0, 16, device="cuda").to(torch.bfloat16).float()` keeps the spread of values. Or use `torch.arange(-8, 8, device="cuda") * 0.25`; I checked that RNE == RTZ for it. Then update the comment at :1590. If you want to test rounding, it belongs in a CUDA-only test: the bridge never converts values, so rounding is Slang/driver behavior.
- **Claims to correct.** The `[Fix Review Request]` says "AC6: CUDA and Vulkan are green". The PR description and explanation comment say the tests pass. That is true only for the L40S/Linux run and needs correcting after the fix.

## Gaps

### G1 (should-change, docs): autograd with `requires_grad=True` bf16 tensors fails with an unclear error

- **Repro (CUDA and Vulkan, both bridges).** Call `[Differentiable] float f(BFloat16 x)` or `[Differentiable] BFloat16 f(BFloat16 x)` with `x.to(torch.bfloat16).requires_grad_(True)`. It raises `BoundVariableException: … TorchTensorDiffPair … Type 'RWDiffTensor<BFloat16, 1>' not found` (`src/sgl/refl/layout.cpp:50`).
- **Root cause (verified).** In Slang 2026.20, `BFloat16` is not `IDifferentiable`. `BFloat16.Differential` gives E30027 (member not found), and `RWDiffTensor<BFloat16,1>` gives E38029 (type argument doesn't conform). SlangPy cannot fix this alone (`escalate-to-slang` if bf16 autograd is wanted).
- **What works.** A `requires_grad=True` bf16 tensor passed to a *non-differentiable* function runs (`float from_bf16(BFloat16)`, both bridges).
- **Ask.** Add "autograd through BFloat16" to the out-of-scope list in the explanation comment, because bf16 activations in mixed-precision training usually have `requires_grad=True`. A clearer error is optional. So is a test that pins the current behavior.

### G2 (nit, test gap): the fallback bridge's auto-allocated bf16 output is untested

- `slangpy/tests/slangpy_tests/test_torch_dtypes.py:100`: `test_torch_output_bfloat16` runs only on the default (native) bridge and only on CUDA. The fallback path is `create_empty_tensor` with code 15 → `_SCALAR_TYPE_TO_DTYPE`.
- My probe shows it works: `BFloat16 to_bf16(float)` and `vector<BFloat16,2> ret(float2)` return `torch.bfloat16` with the correct values under the fallback bridge on CUDA and Vulkan.
- Optional: parametrize this test with `torch_bridge_mode`. The rest of the file doesn't use that fixture, so this is low priority.

## Questions

- **Q1.** On Vulkan, every bf16 kernel compile prints `warning[E41012]: profile implicitly upgraded … spvBFloat16KHR`. The same kernel with `half` prints nothing. The cause is the SPIR-V capability selection in `src/sgl/device/compiler_target.cpp:192+`, which already existed and is not from this PR. This PR makes it visible to torch users, though. Is a follow-up planned to add `spvBFloat16KHR` when `Feature.bfloat16` is present?
- **Q2 (`escalate-to-slang`).** Float→BFloat16 rounding on Vulkan depends on the driver (RTZ on the Windows CI runner, RNE on L40S/Linux). Should Slang emit an explicit RTE rounding mode for `BFloat16(float)` on SPIR-V so it matches CUDA? This is not for this PR, but it is the underlying cause of B1.

## Clarity / nits

- **N1.** `slangpy/tests/slangpy_tests/test_dtypes.py:192-195`:
  - `test_bfloat16_to_numpy_raises` skips when the device lacks `Feature.bfloat16`. But `to_numpy()` raising is a host-side check, so the gate only loses coverage.
  - `pytest.raises(Exception, …)` could be `RuntimeError`, which is what `SGL_CHECK` raises (verified).
- **N2.** `dtype_to_data_type` (`src/slangpy_ext/nanobind.h:398`) has no `Bfloat` → `DataType::bfloat16` case, so it is asymmetric with `data_type_to_dtype`. Its only callers are the coopvec paths (`device.cpp:98,126`), and `to_rhi_cooperative_vector_component_type` (`src/sgl/device/types.h:898`) has no bf16 either. The behavior is consistent, so this is fine to leave. Mention it with the fp8 and cursor follow-ups if you like.

## Verified (facts)

- **New tests on main and on the PR.** On a main build (`68d1e78`, Slang 2026.20), the PR's bf16 tests give `17 failed`. On the PR build, all 17 pass on L40S/Linux with CUDA and Vulkan, both bridges, and no bf16 skips.
- **Touched suites on the PR build.** These are `test_torchintegration`, `test_torch_dtypes`, `test_dtypes`, `test_bridge_fallback_gaps`, `test_reflection2` and `utils/test_torch_bridge`. Result: **934 passed, 92 skipped, 0 failed**. `test_reflection2` now iterates `ScalarType.bfloat16` in `vector_type` and `matrix_type`, and it passes.
- **Static audit.**
  - Every C++ `ScalarType` switch on these paths covers bf16: `tensor.cpp` `scalartype_to_dtype`, `slangpytorchtensor.cpp` `create_output` and `refl/type.cpp` `scalar_type_name`.
  - The `DataType` switches in `data_type.h` and `nanobind.h` cover it too.
  - `ScalarConversionTable` still satisfies `static_assert(COUNT < 32)` (COUNT = 17).
  - The `cursor_utils.h` converter tables now index bf16 inside the array. On main, index 16 equalled `COUNT`, so it was one past the end. A cursor read or write of bf16 now gives a clean "Unsupported element type".
  - The `TENSOR_BRIDGE_SCALAR_BFLOAT16 = 15` mapping and the signature format are unchanged, so no API version bump is needed.
- **Probes** (`reports/review-1261/probe.py`, CUDA and Vulkan × native and fallback). All of these work: auto-allocated bf16 output, `vector<BFloat16,2>` in and out, strided bf16 input, `spy.Tensor(BFloat16).to_torch()`, `vector<BFloat16,2>` `to_torch()`, and `Buffer.to_torch(type=DataType.bfloat16)`. `vector<BFloat16,2>` `to_numpy()` raises the new clear error. A bf16 tensor passed to a `float` param fails the same way a `half` tensor does, which is consistent.
- **Build note.** The local build needed `-DSGL_SLANG_VERSION=2026.20`, because an old CMake cache had pinned 2026.17.1. All results above use 2026.20.

## Unrelated observation (on main already; not this PR)

- On main `68d1e78`, `[Differentiable] half f(half x)` autograd with a `requires_grad=True` float16 tensor fails:
  - On Vulkan it **segfaults** in `slangpy/torchintegration/autogradhook.py:85` (`autograd_backward`).
  - On CUDA, `a.grad` stays `None`.
- `[Differentiable] float f(half x)` works on both. This is worth a separate issue. No action is needed in this PR.

```json
{"verdict":"REQUEST_CHANGES","bugs":1,"gaps":2,"questions":2,"diff_hash":"813dc33fd44d5ae6649194510e4ea51e3054adfc1d8e0fde6a5706117f42674c","reviewers_complete":true}
```
