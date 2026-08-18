---
title: "SlangPy torch-interop tests hardcode device=cuda even under non-CUDA parametrization"
type: learning
topic: slang-compiler
source: learnings/1783886520730-slangpy-torch-interop-tests-hardcode-device-cuda-e.md
---

# SlangPy torch-interop tests hardcode device=cuda even under non-CUDA parametrization

In `slangpy/tests/slangpy_tests/test_torchintegration.py`, tests are parametrized over `DEVICE_TYPES` (Linux: `[vulkan, cuda]`) but ALWAYS create their torch tensors with a hardcoded `device="cuda"` (e.g. `torch.tensor([...], device="cuda", requires_grad=...)`). This is the correct file-wide idiom, NOT a bug and NOT masking a CUDA-only test.

**Why:** torch storage always lives on the CUDA device; the slangpy backend selected by `helpers.get_torch_device(device_type)` is a *separate* device that imports the CUDA memory via external-memory interop. For a non-CUDA backend (Vulkan/D3D12), `get_device(..., cuda_interop=True, existing_device_handles=<CUDA handles>)` adopts the current CUDA context and establishes CUDA↔Vulkan external-memory sharing (`src/sgl/device/device.cpp:124-164`). For a native CUDA slangpy device, interop is disabled (no import needed). So `device="cuda"` on the torch tensor is independent of the slangpy `device_type`, and a Vulkan parametrization genuinely dispatches a Vulkan kernel over CUDA-resident torch data.

**How to apply:** When reviewing a SlangPy torch-integration test, do NOT flag `device="cuda"` hardcoded under a `@pytest.mark.parametrize("device_type", DEVICE_TYPES)` as a CUDA-only-masking bug. Sibling tests (`test_null_grad_idifftensor`, `test_null_grad_difftensor`, `test_nn_parameter_as_input`, `get_test_tensors`) all do the same. The `torch_bridge_mode` autouse fixture (`slangpy/testing/plugin.py`) further multiplies each by native + fallback bridge modes; a 2-backend × 3-combo test = 12 invocations on Linux. Related: torch autograd backward binds every IDiffTensor as a DiffTensor keyed on call_mode (not per-tensor requires_grad), so a no-grad input still needs a bound `_grad_out` scatter buffer — see PR #1057 / issue #1056. On non-CUDA, `tensorcommon.py:153-161` raises TypeError at type-resolution when d_out is None (gated on `!= DeviceType.cuda`), so a missing grad buffer is a clean host error there vs. a CUDA_ERROR_ILLEGAL_ADDRESS abort on CUDA.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1783886520730-slangpy-torch-interop-tests-hardcode-device-cuda-e.md`_
