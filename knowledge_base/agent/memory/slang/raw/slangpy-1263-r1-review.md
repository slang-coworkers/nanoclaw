---
type: source
title: "slangpy#1263 R1 review — REQUEST_CHANGES"
description: "slangpy-reviewer R1 of PR #1263 (#1262 half-gradient fp16 atomic-add error) at 9c77154b, 2026-11-05: REQUEST_CHANGES, 1 bug (check skipped for direct-bound structs; Vulkan still fails in native dispatch)"
---
# Review: shader-slang/slangpy#1263 (round 1)

**PR:** Raise an error for half gradients on devices without fp16 atomic add (fixes #1262)
**Head:** `9c77154b` · **Base:** main `68d1e782` · **Mode:** pr · **Reviewer:** slangpy-reviewer (with a codex second opinion)
**Verdict:** REQUEST_CHANGES. There is 1 bug: the check is skipped for direct-bound structs, and on Vulkan that path still fails in native dispatch instead of raising the new error.

## Summary

The approach is sound. The check runs once per signature, in `gen_calldata`, after overload resolution. It costs nothing at dispatch. It reads `T.Differential`, which is the type `_grad_out` holds. The predicate (`Feature.atomic_half` OR `SPV_EXT_shader_atomic_float16_add`) matches slang-rhi: `vk-device.cpp:877-878` pushes the capability only when `shaderBufferFloat16AtomicAdd` is set, and only CUDA, D3D12 and D3D11 add `Feature::AtomicHalf`. The error names the argument and the selected overload.

The check has one hole. A struct argument that is bound directly never calls `gen_calldata` on its tensor fields. So a backward pass through a `DiffTensor<half>` field in a parameter struct still fails on Vulkan with a native error (B1). Parameter structs are the normal way to pass network weights, and half precision weights are where half gradients matter most. The fix is small.

## Verification (L40S, driver 595.91.07, isolated worktree Debug build of `9c77154b`)

- **Device:** on Vulkan, `has_feature(atomic_half)` is False and `has_capability("SPV_EXT_shader_atomic_float16_add")` is False. The only atomic capability reported is `SPV_EXT_shader_atomic_float_add`. CUDA reports `atomic_half`.
- **New tests at the PR head:** `test_tensor_with_grads.py` gives 17 passed, 1 skipped (half2 on Vulkan). For `test_torchintegration.py -k "half or dtype_specific"`, both bridges give 8 passed and 4 skipped (the dtype test on Vulkan).
- **New tests against main's `tensorcommon.py`:** `test_half_input_grads[half_to_float-vulkan]`, `[half3_to_float-vulkan]` and `test_half_difftensor_param_grads[vulkan]` each segfault (rc 139). `test_half_result_grads[vulkan]` and the CUDA case pass. So the tests do pin the fix. Log: `reports/review-1263/struct-and-main-runs.txt`.
- **Full `slangpy/tests/slangpy_tests` (xdist -n 16):** 2774 passed, 204 skipped, 6 xfailed, 0 failed. This matches the fixer's count.
- **`pre-commit`** on the 4 changed files is clean. **PR CI:** 15 pass, CodeRabbit skipped.
- **Probes** (`/workspace/agent/reports/review-1263/probe.py`, `probe_struct.py`). Logs: `probe-out.txt` has the device info and the per-case runs. Its struct case failed to compile (`DiffTensor` undefined), because the first version of that case had no `import slangpy;`. I added the import afterwards; it is now at `probe.py:98`. So the struct cases were re-run and logged in `struct-and-main-runs.txt` (2 runs per device and mode). The "repeat" row is logged there too:

| Case (bwds) | Vulkan @ PR head | CUDA |
|---|---|---|
| `float f(half4)`, half4 tensor | ValueError (correct: per-element `InterlockedAddF16`) | grads correct |
| `float f(half2)`, half2 tensor | runs, grads correct (carve-out OK) | grads correct |
| `float f(half2)`, (4,2) **half** tensor | ValueError (correct: `DiffTensor<half,2>` adds scalar halves) | grads correct |
| `void f(inout half)` | ValueError | — |
| `float f(no_diff half, float)` | runs, not rejected | runs |
| same failing call ×3, then prim call | same ValueError ×3; prim still works | — |
| **struct `{DiffTensor<half,1> t; float scale}`, dict arg, direct-bound** | **check skipped: `debug_build_call_data` succeeds, dispatch fails with `RuntimeError: basic_string::_M_construct null not valid` (2 of 2 logged runs; an earlier unlogged run dumped core)** | grads correct, `direct_bind = True` (logged) |
| same struct with a vectorized `scale` (not direct-bound) | ValueError | grads correct, `direct_bind = False` (logged) |
| `RWByteAddressBuffer.InterlockedAddF16Emulated` (Slang built-in) | **correct: `[16, 32, 0, -16]`** | correct |

## Bugs

### B1: direct-bound structs skip the check, so a struct field still fails in native dispatch (should-fix; the PR's purpose is a clear error instead of this)

- **Where:** the check is called only from the leaf `gen_calldata` (`slangpy/builtin/tensorcommon.py:437`, `:479`). When a struct is bound directly, `slangpy/core/generator.py:303-305` emits `binding.vector_type.full_name` and does not recurse into the children. A struct is bound directly when it has dim 0, read access, and all its children are bound directly (`slangpy/builtin/struct.py:79-87`). A tensor child is bound directly when its target type is an explicit `ITensorType` (`tensorcommon.py` `can_direct_bind`).
- **Repro** (Vulkan, L40S, PR head):
  ```slang
  import slangpy;
  struct S { DiffTensor<half, 1> t; float scale; }
  [Differentiable] float f(S s, int i) { return float(s.t.load({i})) * s.scale; }
  ```
  ```python
  t = Tensor.from_numpy(device, np.arange(4, dtype=np.float16)).with_grads(zero=True)
  f.bwds({"t": t, "scale": 3.0}, np.arange(4, dtype=np.int32), _result=y)   # RuntimeError from native dispatch, no ValueError
  ```
  If `scale` is a tensor, the struct is no longer bound directly, and the same call raises the new ValueError. On CUDA, the direct-bound call gives correct grads (`[3, 3, 3, 3]`).
- **Fix direction (fixer's choice):** run the same check on every tensor leaf under a direct-bound struct. For example, the `binding.direct_bind` branch of `_emit_call_data_code` can walk `binding.children` recursively. For each leaf whose `vector_type` is an `ITensorType`, call `_check_half_grad_accumulation(context, child, child.vector_type.element_type, child.vector_type.tensor_kind, child.vector_type.access)`. These leaves are always explicit `ITensorType`, because that is what makes them bindable directly. Another option is a single walk over the whole `BoundCall` in `CallData` before code generation. Do not turn off direct binding for every struct that holds a diff tensor (codex's suggestion). That changes code generation for float structs as well.
- **Test:** add a case like the one above to `test_tensor_with_grads.py`, gated on `has_half_atomic_add` in the same way as the other tests. A dict of torch tensors takes the same `StructMarshall.can_direct_bind` path. I did not run that case.

## Gaps

- **G1: the half2 carve-out is not tested where it matters** (`test_tensor_with_grads.py:158`). `test_half2_input_grads` skips on every device without `Feature.atomic_half`, which means every Vulkan device. The exemption applies on every device, but NVIDIA Vulkan is the case it exists for, and no test checks that half2 is not rejected there. If someone tightens the check later, no test fails. Suggestion: on Vulkan, assert that `bwds` does not raise the ValueError. Check the grads only when the adapter is NVIDIA. My probe shows they are correct on the L40S.
- **G2: an existing test loses Vulkan coverage** (`test_torchintegration.py:239-240`). `test_diff_pair_scalar_overload_uses_dtype_specific_call_data` only calls `debug_build_call_data` and never dispatches, so it passed on Vulkan before this PR. Now the half build raises there, and the whole test is skipped. Suggestion: on devices without fp16 add, keep the float build and assert that the half build raises `ValueError` matching `Feature.atomic_half`. That keeps Vulkan coverage of the float path and pins the build-time error. Keep the two-key comparison on devices that have fp16 atomic add. Minor.
- **G3: the tests copy the production predicate** (`slangpy/testing/helpers.py:286` duplicates `tensorcommon.py:420-424`, with the same comment). If the predicate is wrong, the tests agree with it and do not catch the mistake. Advisory. A single shared function would remove the duplicated literal and comment, but it would not make the tests independent. For that, add an expectation per device that is asserted separately, for example: on CUDA with compute capability 7.0 or higher, the predicate must be True.

## Questions (for maintainers / the explanation comment)

- **Q1: should NVIDIA Vulkan get working half gradients instead of an error?** Slang already ships `RWByteAddressBuffer.InterlockedAddF16Emulated` (`source/slang/hlsl.meta.slang:7210` at v2026.20). On SPIR-V, it does a scalar fp16 add as a half2 vector atomic, with 0 in the other lane. It needs `AtomicFloat16VectorNV`, the same capability that the half2 carve-out already relies on. On the L40S Vulkan device it is correct (`[16, 32, 0, -16]`). It is also the same trick that Slang's own HLSL/NVAPI `InterlockedAddF16` uses. It is not a drop-in replacement:
  - slang-rhi does not report the NV fp16-vector capability, so SlangPy would need a define or a probe to select it.
  - It does a 4-byte atomic on `addr & ~3`. For the last element of a half buffer with an odd number of elements, that touches 2 bytes past the end. Allocation alignment usually hides this, but it needs an audit.

  I suggest listing it in the explanation comment as alternative D, next to the CAS loop (B), because it avoids a CAS retry loop. Its speed has not been measured. This does not block this PR. An error is better than a segfault.
- **Q2 (scope, not chased):** a user `IDifferentiable` struct whose `Differential` contains half fields with a custom `IAtomicAddable` is not checked. `_is_half_element` returns False for struct types. This is rare. One line in "Not covered" in the explanation comment would be enough.

## Clarity

- **C1: the error message gives Vulkan users incomplete advice** (`tensorcommon.py:426-428`). The message says to use "a device that supports Feature.atomic_half". slang-rhi never sets that feature on Vulkan, but the check accepts Vulkan devices that report `SPV_EXT_shader_atomic_float16_add`. A Vulkan user who checks `device.has_feature(Feature.atomic_half)` always gets False. Moving to a device that has `Feature.atomic_half` is still a valid workaround, but the message does not say that a Vulkan device with the capability also works. Suggested wording: "…with float16 atomic adds, which this vulkan device does not support (it needs Feature.atomic_half, or SPV_EXT_shader_atomic_float16_add on Vulkan). Use a float input, or a device with float16 atomic add such as CUDA." Keep `Feature.atomic_half` in the text, because the tests match on it.
- **C2 (nit):** "Use a float input" does not help someone who passed an explicit `IDiffTensor<half,1>` parameter, because they must also change the Slang signature. Consider "use float gradients (float input or float tensor type)".

## Fixer judgment calls

- **(a) half2 not checked:** agreed. Vulkan half2 grads are correct on the L40S, so gating them would be a regression. The cost is G1.
- **(b) explicit `AtomicTensor<half>` not blocked:** agreed. The type alone cannot tell `load` from `add`.
- **(c) reads `T.Differential`:** correct. `DiffTensor._grad_out` is `AtomicTensor<T.Differential, D>`.
- **(d) conservative `load_once` rejection:** acceptable, and documented in the explanation comment.
- **Side note** (explicit `diff_pair(torch…)` bwds misbehaving with float): not reviewed. It is out of scope here.

## Requested for round 2

1. B1 fix and a direct-bound struct regression test.
2. C1 message wording.
3. Optional: G1, G2, G3, and Q1 added to the explanation comment.

```json
{"verdict":"REQUEST_CHANGES","bugs":1,"gaps":3,"questions":2,"diff_hash":"2a3251fa0edd93de760fc530772e8d1dc3a7a10b2f4ba160b56ce9f9fd435dcd","reviewers_complete":true}
```
