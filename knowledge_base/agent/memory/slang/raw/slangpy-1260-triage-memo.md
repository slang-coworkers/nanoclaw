---
type: triage
title: "slangpy#1260 — torch bridge rejects torch.bfloat16 (no bfloat16 in SGL ScalarType/DataType)"
description: "Enhancement with a latent OOB bug: torch.bfloat16 is missing from the torch dtype tables, and SGL's TypeReflection::ScalarType has no bfloat16, so the nanobind enum rejects Slang's value 16 (== ScalarType::COUNT). Repro'd on L40S CUDA; BFloat16 kernels themselves run bit-exact on CUDA and Vulkan. Approach A (first-class bfloat16) handed to slangpy-fixer 2026-11-05."
tags: [torch-integration, torch-bridge, bfloat16, dtype, reflection, sgl-enum, latent-oob]
---

# slangpy#1260 — PyTorch bridge rejects torch.bfloat16

**Classified:** enhancement (missing dtype support, never supported → not a regression) + latent bug / medium / P2 / torch-integration · SGL reflection · nanobind-bindings / cross-backend (verified CUDA + Vulkan on L40S) / Duplicate: no / Upstream-Slang: no. Triaged 2026-11-05 @ main `68d1e782` (Slang 2026.20). Reporter: tekintatar (external). Torch-bridge owner by git log: ccummingsNV.

**Judgment call (routing):** an enhancement, but handed to the fixer rather than parked. It has a reproducer, it follows the repo's own "Adding a new torch dtype" checklist (`.github/instructions/torchintegration.instructions.md:143-147`), and the bridge already carries bf16 (code 15). The draft PR is the maintainer gate.

## What's broken
`module.f(grid, src, torch_bf16_tensor)` with an `RWTensor<BFloat16,1>` parameter → `BoundVariableException ... Unsupported torch dtype torch.bfloat16` (ValueError at `slangpy/torchintegration/torchtensormarshall.py:345`). The `half` + `torch.float16` control passes.

## Repro (L40S, 2026-11-05) — FACTS
- Build: worktree `tmp/wt-1260` @ 68d1e782, `slangpy_ext` only. Venv `tmp/venv-1260` (torch 2.15.0+cu132). Native bridge built into `tmp/repro-1260/slangpy_torch_site`.
- `cd /tmp && PYTHONPATH=/workspace/agent/tmp/wt-1260 /workspace/agent/tmp/venv-1260/bin/python /workspace/agent/tmp/repro-1260/repro_torch_bfloat16.py` → exit 1, same error. With `float16` → `float16: OK`.
- The native bridge (add `:…/slangpy_torch_site` to PYTHONPATH; `is_torch_bridge_using_fallback()` False) fails identically at :345. Bridge choice is irrelevant.
- Reflection: `find_type_by_name("BFloat16")` → kind scalar, size 2. `.scalar_type` → `ValueError: 16 is not a valid ScalarType.` (nanobind non-flag enum).
- SlangPy's own `Tensor.empty(..., dtype="BFloat16", program_layout=module.layout)` + `to_bf16` dispatch works, bit-exact vs RNE on **both CUDA and Vulkan** (Vulkan adds `spvBFloat16KHR` to the profile automatically; warning only). `.to_numpy()` / `.to_torch()` / `repr()` fail: `Unsupported tensor element scalar type` (`src/slangpy_ext/func/tensor.cpp:86`).
- A function returning `BFloat16` with a torch input → `16 is not a valid ScalarType` (`torchtensormarshall.py:68`). A scalar return → the same error (`builtin/value.py:40`). A Python float into a `BFloat16` param → `Unsupported element type` (`cursor_utils.h:351`).
- Logs: `tmp/repro-1260/run-*.log` (+ `run-vk-cuda-spytensor.log`).

## Reporter's claims vs main
- ✅ The torch tables lack bf16 (`torchtensormarshall.py:34-56`). ✅ `ScalarType` (`src/sgl/device/reflection.h:426-444`, ends uintptr=15, `COUNT`=16) and `DataType` (`src/sgl/core/data_type.h:10-26`, already has float8_e4m3/e5m2) lack bf16. ✅ `bridge_fallback.py:30` maps bf16→15, matching `tensor_bridge_api.h:58`. ✅ slang.h (2026.20) has `SLANG_SCALAR_TYPE_BFLOAT16=16`, plus `FLOAT_E4M3=17` and `FLOAT_E5M2=18`.
- ⚠️ The suggested fix is incomplete. It misses: the C++ `NativeTorchTensorMarshall::create_output` switch (`src/slangpy_ext/utils/slangpytorchtensor.cpp:719-751`, default throws → auto-allocated torch outputs); `scalar_type_name` in `src/sgl/refl/type.cpp:144-176` (`layout.scalar_type()` throws for unknown values); `get_scalar_type_cpu_size` in `src/sgl/device/cursor_utils.h:40-66`; `scalartype_to_dtype` in `src/slangpy_ext/func/tensor.cpp:17-55` (dlpack `Bfloat`); `slangpy/core/jupyter.py:122-138`.
- `_torch_to_data_type` has no consumers (only the instructions doc mentions it).

## Latent defect (separate from the ask) — FACT + HYPOTHESIS
`src/slangpy_ext/device/cursor_utils.h` read/write converter tables are sized `[ScalarType::COUNT]` (:205-207, :474-482) and indexed with the raw `scalar_type()` / `getScalarType()` (:221/224/226, :427, :634/643, :721) **without a bounds check**. Slang value 16 (bf16) indexes one past the end today; 17/18 (fp8) stay out of bounds even after bf16 is added. HYPOTHESIS: the observed `Unsupported element type` came from the adjacent `m_write_vector[0][0]` error handler by luck (UB). Fix: if index ≥ COUNT, use the error function. Ship as its own PR **without** `Fixes #1260`, or as a separate commit in the bf16 PR if the maintainer prefers.

## Candidate approaches
### A: First-class `bfloat16` scalar type (RECOMMENDED)
- Where:
  - C++: `reflection.h:426` enum + SGL_ENUM_INFO (`bfloat16 = SLANG_SCALAR_TYPE_BFLOAT16`, so COUNT→17); `data_type.h` (`bfloat16`, size 2, enum info); `type.cpp:169` → `"BFloat16"`; `sgl/device/cursor_utils.h` cpu size 2; `slangpytorchtensor.cpp:719` → `TENSOR_BRIDGE_SCALAR_BFLOAT16`; `func/tensor.cpp:17` → dlpack `Bfloat` (to_torch; to_numpy keeps a clear error, since numpy has no bf16).
  - Python: `torchtensormarshall.py:34-56` (both tables; reverse map is automatic); `reflectiontypes.py:54` `scalar_names` → `"BFloat16"`; `value.py:185/201/217` names/python-type/size; `jupyter.py`.
  - Regenerate `py_doc.h` / `docs/generated/api.rst`.
- Behaviour delta: torch bf16 tensors bind to `Tensor/RWTensor<BFloat16,N>`, auto-allocated outputs become `torch.bfloat16`, and spy bf16 tensors gain `to_torch`.
- Tradeoffs: about 10 files, mostly one line each; the public enum gains a member. **No `TENSOR_BRIDGE_API_VERSION` bump** (code 15 already exists, signature format unchanged; signature becomes `D1,S15,V1`).
- Risk: (1) BFloat16 has no `IDifferentiable` conformance in Slang core, so keep `differentiable=False` and expect diff-pair/autograd paths to reject it cleanly. (2) Adding it to `FLOAT_TYPES` (value.py:40 → Python `float` return) also needs a bf16 read/write converter in `slangpy_ext/device/cursor_utils.h` (bits<<16 read, RNE write); otherwise leave it out and let scalar bf16 return/uniform writes raise cleanly. Fixer's call; document it.
### B: Python-only torch mapping via `find_type_by_name("BFloat16")`, no enum change
- Behaviour delta: fixes only the input-tensor case.
- **Ruled out by a constraint:** the nanobind `ScalarType` enum rejects value 16, so every `.scalar_type` / `slang_scalar_type` read on a BFloat16 reflection raises (`torchtensormarshall.py:68` return path, `value.py:40`). The C++ `create_output` switch reads it natively and throws. Every workaround would be a special case.
### C: A plus fp8 (`FLOAT_E4M3`=17, `FLOAT_E5M2`=18), to sync ScalarType with slang.h
- Behaviour delta: also binds `torch.float8_e4m3fn` / `float8_e5m2`.
- Tradeoffs: bigger diff and new bridge codes (not in `tensor_bridge_api.h` today → API version bump). The torch `e4m3fn` (no-inf) vs Slang E4M3 semantics are unverified. Better as a follow-up issue.

## Acceptance criteria (handed to fixer)
1. The reporter's script prints `bfloat16: OK` on CUDA with both the fallback and the native bridge.
2. `TypeReflection.ScalarType.bfloat16` exists, and reflecting `BFloat16` returns it.
3. A function with a `BFloat16` result and a torch input returns a `torch.bfloat16` tensor.
4. `spy.Tensor` bf16 `.to_torch()` works; `.to_numpy()` raises a clear error.
5. Tests cover `test_torchintegration.py` (signature `D1,S15,V1` parametrize + an end-to-end write vs `.to(torch.bfloat16)`) and `test_dtypes.py`; bf16 tests skip where the device lacks bf16.
6. The torch and dtype suites pass on CUDA + Vulkan on the L40S; float16 is unchanged.

## Sources
- Shared wiki: two dtype maps must both change (`slang-a-slangpy.md`). Native/fallback bridge signatures must match; a "native" run without the built extension silently falls back (`slangpy-torch-autograd.md`). API version bumps collide.
- DeepWiki (slangpy): it lists the same tables plus `create_output`, but **misses** the SGL enum (treat it as a lead only). DeepWiki (slang): BFloat16 on CUDA needs sm_80; on SPIR-V `SPV_KHR_bfloat16` / `spvBFloat16KHR`; reflected as `SLANG_SCALAR_TYPE_BFLOAT16`.
- gh: no duplicates. The bf16 bridge code dates from PR #814 ("Optimize value types").

## State
- 2026-11-05: triaged → handed to slangpy-fixer (Approach A). Issue 5-bullet posted (id in `.gh-comments/shader-slang-slangpy-1260.id`). Waiting for `[Fix Report]`.
