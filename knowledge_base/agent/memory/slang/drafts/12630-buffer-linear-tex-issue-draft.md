---
type: draft
description: Triager-staged (2026-10-29) follow-up issue for CUDA Buffer<T> as linear-memory texture object; not yet filed
---

Title: CUDA: support read-only `Buffer<T>` as a texture object over linear memory (`tex1Dfetch`)

Raised by @albertrodriguezclo on #12630 (comment 6509184430). Porting CUDA code that reads inputs through `cudaTextureObject_t`s created over linear device memory (`cudaResourceTypeLinear`, `tex1Dfetch<T>(tex, i)`) has no direct Slang target today.

**Current behaviour (master 977df1246):**

```slang
[shader("compute")][numthreads(128, 1, 1)]
void k(uniform Buffer<float> flt, uniform float* outp, uniform uint n, uint3 tid: SV_DispatchThreadID)
{
    if (tid.x >= n) return;
    outp[tid.x] = flt[tid.x];
}
```

- `-target cuda` / `-target ptx`: `error[E36107]` with a note on `__ShapeBuffer`. The rejection is the type-level `[require(cpp_glsl_hlsl_metal_spirv)]` on `__ShapeBuffer` (`source/slang/hlsl.meta.slang:589`), added by #12289 so that `Buffer<T>` access fails loudly instead of compiling to an empty kernel (#12274).
- spirv / metal / hlsl compile.
- `Texture1D` on CUDA is the CUDA-array path. #13377 (draft) documents 1D texture objects over linear memory as unsupported for `Texture1D.Load`.

**Request:** lower read-only `Buffer<T>` on CUDA/PTX to a `CUtexObject` read with `tex1Dfetch<T>(obj, i)` (PTX `tex.1d.v4.{f32,u32,s32}.s32`, no level), and keep `Texture1D` for CUDA arrays.

**Workaround today** (verified on an L40S, CUDA 12.6: 1000/1000 values correct with a `CU_RESOURCE_TYPE_LINEAR` float texture object):

```slang
float fetchLinear(uint64_t tex, int i)
{
    __target_switch
    {
    case cuda: __intrinsic_asm "tex1Dfetch<float>((cudaTextureObject_t)$0, $1)";
    }
}
```

Pass the `CUtexObject` as a `uniform uint64_t`. The emitted PTX is `tex.1d.v4.f32.s32`. Plain pointer loads are another option; the reporter measured them within 7% of the texture path on sm_89.

**Points a fix has to decide:**
- Layout and reflection: `Buffer<T>` on CUDA would become an 8-byte `CUtexObject` slot. Today it is rejected, so no existing CUDA layout changes.
- Element types the texture hardware can return (32-bit single channel is the reported case; `float3`-like formats have no texture format).
- `RWBuffer<T>` stays out of scope (texture objects are read-only).
- slang-rhi creates texture objects only over CUDA arrays (`src/cuda/cuda-texture.cpp:237`) and has no linear-memory path, so slang-rhi/SlangPy users would also need a buffer-view change there. Raw-CUDA hosts that build their own texture objects would work without it.

Related: #12274, #12289, #12630, #13377.
