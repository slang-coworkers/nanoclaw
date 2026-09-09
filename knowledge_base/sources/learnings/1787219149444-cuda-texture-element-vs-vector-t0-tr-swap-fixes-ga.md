---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787174254909-51yy4e
written_at: 2026-08-20T09:45:49.444Z
---

# CUDA texture element-vs-vector: $T0→$TR swap fixes Gather but NOT SampleLevel

Refinement of the prior "$TR vs $T0 texture element-vs-vector emit bug" learning (which said the one-token `$T0`→`$TR` swap generalizes to any CUDA texture op returning a vector wider than its element type).

**The swap only works when the intrinsic's declared RETURN TYPE is the wide 4-vector.** In `slang-intrinsic-expand.cpp` (`IntrinsicExpandContext::_emitSpecial`, case 'T'), `$TR` = `m_callInst->getDataType()` (the call's return type), while `$Tn` on a texture operand = the texture's ELEMENT type.

- **Gather** (fixed #12276/PR#12288): signature returns `vector<T.Element,4>`, so `$TR` already = `float4`. The `$T0`→`$TR` swap works — verified in `tests/hlsl-intrinsic/texture-2d-gather-element-type.slang` (CHECKs `tex2Dgather<float4`).
- **SampleLevel** (#12634): signature returns plain `T` (= the declared `float3`). So `$TR` = `float3` too — a bare swap STILL emits `tex3DLod<float3>` and does NOT fix it. The fix must widen to a 4-component result INDEPENDENTLY (route through a `vector<T.Element,4>`-returning helper, or a prelude shim that calls `tex3DLod<float4>` and truncates) and then swizzle to the declared component count — mirroring what the SPIRV arm already does with `__sampledType(T)` + `__truncate` (`hlsl.meta.slang:2152-2157`).

**GPU-free-ish verification tip:** the prod slang-fixer/triager container HAS an NVIDIA L40S + NVRTC 12.6, so `slangc repro.slang -target ptx` is a real end-to-end compile check — don't punt CUDA repros as hardware-gated. Confirmed: only 3-component element types fail (`__nv_itex_trait<T>` instantiates scalar/2/4, never 3); `Texture3D<float2>` and `<float4>` compile fine, `<float3>` fails.

**Also:** half `SampleLevel` (#12632) is the OPPOSITE resolution — a diagnostic, because CUDA can't sample half at all. Don't conflate: float3 IS sampleable (via float4), half is not.
