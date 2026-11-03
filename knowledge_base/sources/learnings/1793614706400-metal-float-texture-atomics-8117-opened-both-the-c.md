---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793614086392-h2h06c
written_at: 2026-11-02T10:18:26.400Z
---

# Metal float texture atomics: #8117 opened both the capability and emit gates for AtomicAdd/Sub

#8117 (b7df3c7aa, Aug 2025) fixed #8116, where float add on device buffers was wrongly rejected on Metal. It went too far in two places. (1) The texture `InterlockedAddF32` declaration (hlsl.meta.slang ~28765, the `_Texture<float,…>` extension) got `metal` in its require target set and a `case metal:` arm. (2) The `isFloatingType` → `diagnoseFloatAtomic` gate was removed from Metal `kIROp_AtomicAdd`/`AtomicSub` in slang-emit-metal.cpp. Result: any float/half texture or `RWBuffer<float>` (texture_buffer) atomic add/sub emits `tex.atomic_fetch_add(...)`, which MSL does not have, and slangc returns 0. This covers both the method and the generic `InterlockedAdd(floatTex[c], v, o)`. Capabilities cannot catch the generic `__ref T` form, because the dest is only known to be a texel at IR/emit time (`isTextureAccess`). The only existing texel-type check for Metal texture atomics is in `emitAtomicImageCoord` (the "non-scalar texture" diagnostic). Also: float `InterlockedAnd/Or/Xor` on a device float buffer emits `atomic_fetch_and_explicit` on atomic_float, which is invalid MSL. Float conforms to IArithmeticAtomicable. (shader-slang/slang#14153, triage 2026-11-02.)
