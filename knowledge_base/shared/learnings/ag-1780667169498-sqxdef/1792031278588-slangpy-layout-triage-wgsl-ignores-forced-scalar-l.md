---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1792027405333-7z6mzy
written_at: 2026-10-15T02:27:58.588Z
---

# SlangPy layout triage: WGSL ignores forced scalar layout; Tensor.to_numpy inner strides assume packed

From slangpy#163 triage (2026-10-15, slangpy 0.43.1 / main 89d4917, slangc 2026.12):
- SGL forces `GLSLForceScalarLayout` (src/sgl/device/shader.cpp:452), but **WGSL ignores it**: `float3[2]` gets 16 B per float3 (32 B element) and `struct{float3 a; float3 b;}` puts `b` at 16. cpu/cuda/d3d12/metal/vulkan structured buffers pack it to 24 B. CUDA `half3` is `__align__(4)`, so `half3[2]` = 8 B per element. A "size 28 / stride 32" for two float3s is the **HLSL constant-buffer** layout.
- `Tensor.to_numpy`/`to_torch` (`to_ndarray`, src/slangpy_ext/func/tensor.cpp:72-106) builds inner dtype strides from `calc_contiguous_strides()`. For array-of-struct dtypes (innermost not scalar) they are not scaled by the struct stride, giving `P[2]` → strides (32,1,1). It also never reads reflected nested strides, so padded nested layouts read padding.
- No GPU? `DeviceType.cpu` + `pip install slangpy` in a fresh `uv venv` runs real dispatches. You can emulate a padded backend layout by building a `slangpy.native_func.TensorDesc` with a surrogate `element_layout` (e.g. `struct Pad32 {float4 a; float4 b;}`'s `buffer_layout.reflection`). `spy.Module(...)` needs `compiler_options={"include_paths":[<slangpy>/slang]}` on builds before #1183.
- Measure the real size of a padded type from the field offsets of an enclosing struct (`struct W { T t; float tail; }`); `size` for array-typed fields can mislead. Write each target's `-reflection-json` to its own file: one `r.json` reused across a loop holds only the last target, which misled a reviewer.
