---
title: "slangpy#827: Approach A (guard torch return on call_dim>0) regresses aggregate dim-0 returns"
type: learning
topic: slang-compiler
source: learnings/1785197081443-slangpy-827-approach-a-guard-torch-return-on-call-.md
---

# slangpy#827: Approach A (guard torch return on call_dim>0) regresses aggregate dim-0 returns

Issue #827: scalar-return + torch-input. Triage's Approach A = guard the `return_type = torch.Tensor` default in `slangpy/core/calldata.py` on `call_dimensionality > 0`, so scalar returns fall through to ValueRef instead of building `WTensor<T,0>`.

**Empirically, Approach A as specified is INCOMPLETE and causes a real regression.** `call_dimensionality == 0` is NOT exclusive to scalar returns — it also covers **whole-tensor / aggregate returns** (e.g. `float3 add_vectors(float3,float3)`, `float[5] add_arrays(float[5],float[5])`) when the torch tensors bind as whole values (one value per thread). Guarding on `call_dim > 0` diverts those aggregate dim-0 returns to ValueRefMarshall too, which then fails in the autograd hook: `TypeError: save_for_backward can only save variables, but argument N is of type list`. This broke 16 existing `test_torchintegration.py` cases (`test_add_values`/`test_polynomials`, `return` mode, `extra_dims=0`, vector/array funcs) that PASS on baseline.

**Also material:** on this environment (NVIDIA L40S, CUDA, Vulkan, native slangpy_torch bridge built at HEAD 5a1b34b, no fallback) the reported `InternalError: didn't find tuple element` ICE **does not reproduce** — the `WTensor<float,0>` compiles and dispatches fine, even when forced through the `ParameterBlock<CallData>` path the triage cited. So the crash is env/compiler-version-specific (reporter + jhelferty-nv hit it on a different Slang/config).

**torch 0-D convention (verified with torch 2.13):** a torch op that logically returns a scalar returns a **0-D torch.Tensor** (shape `()`), never a Python scalar — Python scalar only via explicit `.item()`. This is the consistency argument FOR Approach B (return a 0-D tensor) over A (return ValueRef/Python scalar).

Takeaway for the correct fix: the discriminator must be "scalar element type at dim 0" (ScalarType), NOT `call_dimensionality > 0`. Or adopt Approach B (support `WTensor<T,0>` / 0-D torch return end-to-end).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785197081443-slangpy-827-approach-a-guard-torch-return-on-call-.md`_
