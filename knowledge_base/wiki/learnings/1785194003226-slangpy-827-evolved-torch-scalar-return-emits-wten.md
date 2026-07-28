---
title: "slangpy #827 evolved: torch scalar-return emits WTensor&lt;T,0&gt; → Slang ICE (live at HEAD)"
type: learning
topic: slang-compiler
source: learnings/1785194003226-slangpy-827-evolved-torch-scalar-return-emits-wten.md
---

# slangpy #827 evolved: torch scalar-return emits WTensor&lt;T,0&gt; → Slang ICE (live at HEAD)

slangpy issue #827 ("memory leak on Vulkan+torch interop") evolved into a DIFFERENT live bug — worth knowing when re-triaging it.

**Original leak**: reportedly fixed by PR #781. On CUDA at HEAD it's flat (no leak, prior L40S probe). Vulkan+cuda-interop can't be measured on the L40S/linux runner (`command_encoder->finish() SLANG_FAIL`), so the *titled* Vulkan leak is unverified — needs a Vulkan+enable_cuda_interop runner to close.

**Live blocker (still present at HEAD 5a1b34b, 2026-07)**: calling a scalar-returning Slang fn (e.g. `float test(ITensor<float,1>, float)`) with a torch.Tensor arg on a non-CUDA backend crashes the Slang compiler: `InternalError: unexpected: didn't find tuple element`.

Root cause (confirmed by reading source):
- `slangpy/core/calldata.py:207-208` sets `return_type = torch.Tensor` UNCONDITIONALLY when a torch tensor is present, BEFORE `call_dimensionality` is computed (`calldata.py:262`).
- `create_return_value_binding` (`callsignature.py:222-227`) only applies its `call_dimensionality==0 → ValueRef` default when `return_type is None`. Since it's already torch.Tensor, scalar returns skip ValueRef.
- torch marshall factory `torchintegration/torchtensormarshall.py:254-268` (line 265) uses `bind_context.call_dimensionality` (=0) → builds `WTensor<T,0>` with zero-length `uint[0] _shape`/`_strides` → Slang ICEs during type legalization in a ParameterBlock.
- Regression from PR #759 (replaced TensorRef w/ direct torch.Tensor); latent since #362 (the dim0→ValueRef guard was disabled with `and False`). No regression test in `test_torchintegration.py`.

Two fixes, and it's a SEMANTICS decision not a pure bug: (A) guard override to `call_dimensionality>0` → scalar returns become Python floats (surgical, but not torch-faithful); (B) support 0-D torch returns end-to-end → return a 0-D torch.Tensor (matches torch, larger, maybe upstream Slang). ccummingsNV asked to verify torch's real 0-D behavior first. The compiler ICE itself is arguably an upstream shader-slang/slang robustness bug.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785194003226-slangpy-827-evolved-torch-scalar-return-emits-wten.md`_
