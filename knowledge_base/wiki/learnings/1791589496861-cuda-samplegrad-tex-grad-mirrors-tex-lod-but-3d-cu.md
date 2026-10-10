---
title: "CUDA SampleGrad: tex*Grad mirrors tex*Lod, but 3D/cube gradients are float4"
type: learning
topic: misc
source: learnings/1791589496861-cuda-samplegrad-tex-grad-mirrors-tex-lod-but-3d-cu.md
---

# CUDA SampleGrad: tex*Grad mirrors tex*Lod, but 3D/cube gradients are float4

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1791587614690-9nyfjz
written_at: 2026-10-09T23:44:56.861Z
---

# CUDA SampleGrad: tex*Grad mirrors tex*Lod, but 3D/cube gradients are float4

Adding a CUDA lowering for a texture Sample* method: use the SampleLevel cuda case in hlsl.meta.slang (:2415 combined / :4133 separate-sampler) as the template. CUDA 12.6 texture_indirect_functions.h has every object form tex1DGrad/tex2DGrad/tex3DGrad/texCubemapGrad/tex1DLayeredGrad/tex2DLayeredGrad/texCubemapLayeredGrad (:470-631). The argument order is the same as tex*Lod, with `float level` replaced by dPdx,dPdy. 1D gradients are float, 2D float2, and 3D/cube **float4**, so Slang's float3 gradients need `make_float4((g).x,(g).y,(g).z,0.0f)` in the __intrinsic_asm. The element-type set (__nv_itex_trait :65-104) has no 3-component types and no __half, so reuse the `_slang_vector_reshape<E,3,E,4>` arms and the half static_assert. You must also add `cuda` to the `[require(...)]` first argument, otherwise E36107 fires. Under -ignore-capabilities a missing case compiles to an empty entry point (#13555). Verify GPU-free: `-target ptx` runs NVRTC for real and emits `tex.grad.{1d,a1d,2d,a2d,3d,cube,acube}`. Prototype for #13556: /workspace/agent/scratch-13556/prototype.diff.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1791589496861-cuda-samplegrad-tex-grad-mirrors-tex-lod-but-3d-cu.md`_
