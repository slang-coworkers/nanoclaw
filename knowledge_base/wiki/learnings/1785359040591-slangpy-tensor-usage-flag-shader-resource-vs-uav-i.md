---
title: "SlangPy: Tensor usage flag (shader_resource vs UAV) is load-bearing for ARRAY-of-Tensor params, not scalar"
type: learning
topic: slang-compiler
source: learnings/1785359040591-slangpy-tensor-usage-flag-shader-resource-vs-uav-i.md
---

# SlangPy: Tensor usage flag (shader_resource vs UAV) is load-bearing for ARRAY-of-Tensor params, not scalar

When a Slang function takes an ARRAY of read-only tensors — `Tensor<float,1> tensors[4]` — and you pass a Python `list[Tensor]`, each element Tensor MUST be created with `usage=BufferUsage.shader_resource` (SRV-only, no UAV bit). If you let it default (`shader_resource | unordered_access`), type resolution FAILS on ALL backends.

Why: a Tensor's writability is derived from the UAV bit at `slangpy/builtin/tensor.py:~184` (`(value.usage & BufferUsage.unordered_access) != 0`). A writable marshall builds its slang_type as `RWTensor<...>` (access prefix baked into the name by `src/sgl/refl/type.cpp build_tensor_name`). The ARRAY resolver `ArrayMarshall.resolve_types` → `array_to_array_scalarconvertable` (`slangpy/reflection/vectorize.py:~115-119`) compares element types by **full_name STRING**: `"RWTensor<float,1>" == "Tensor<float,1>"` is False → returns None → resolution fails.

Crucially this is ASYMMETRIC vs the SCALAR path: a scalar `Tensor<float,1>` param resolves fine even from a default-UAV tensor, because `slangpy/builtin/tensorcommon.py:~199` rebuilds the resolved type with `access=bound_type.access` (the PARAMETER's access, not the argument's writability). Arrays have no equivalent access-adaptation — a real footgun / latent gap (tracked context: shader-slang/slangpy#1079).

Reviewer takeaway: do NOT suggest "just drop the shader_resource override to match other tests" for array-of-Tensor tests — it's correct for scalars but breaks arrays. I made exactly this wrong suggestion reviewing #1078 and had to retract it after tracing the source. Separately: passing a read-only (SRV-only) Tensor into an array dispatch on D3D12 currently triggers ClearUnorderedAccessViewUint on the non-UAV buffer → device removal (whole shared d3d12 device poisoned → cascade of "Failed to create device" across unrelated tests). That cascade reads as an infra/runner flake unless you find the FIRST failing test (the one showing RemoveDevice); spot-checking tests that ran before it will mislead you.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785359040591-slangpy-tensor-usage-flag-shader-resource-vs-uav-i.md`_
