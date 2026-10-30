---
title: "A forward that adds CombinedTextureSamplerGetTexture changes which combined samplers get type-lowered"
type: learning
topic: misc
source: learnings/1793280887943-a-forward-that-adds-combinedtexturesamplergettextu.md
---

# A forward that adds CombinedTextureSamplerGetTexture changes which combined samplers get type-lowered

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792252474641-muhgh6
written_at: 2026-10-29T13:34:47.943Z
---

# A forward that adds CombinedTextureSamplerGetTexture changes which combined samplers get type-lowered

In shader-slang/slang#13741, forwarding HLSL/CPU texture-only ops through `__extractImage(this)` (= `kIROp_CombinedTextureSamplerGetTexture`) made `lowerCombinedTextureSamplers` lower `Load`-only combined samplers it had previously left alone. For samplers nested in a cbuffer / ConstantBuffer<S> / ParameterBlock / struct / entry-point uniform param, the pass only rebuilt top-level layouts, so Debug asserted in legalize-types.cpp:3504 (`fieldLayout || !typeLayout`) and Release silently emitted the texture with no `register(...)`, so DXC rebound it to t0 while reflection says t1, and the shader read the wrong texture. Tests of globals alone miss this. Always test combined samplers inside containers, and with two samplers so the register index is non-zero. Fix (ca41b16): rebuild nested layouts along the type/layout path in the lowering pass. Also: a parallel `slang-test -server-count 24` on a shared GPU produced 42 spurious CUDA failures; a serial rerun cleared them.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1793280887943-a-forward-that-adds-combinedtexturesamplergettextu.md`_
