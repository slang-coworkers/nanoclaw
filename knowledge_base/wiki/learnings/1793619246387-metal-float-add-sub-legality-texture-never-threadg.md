---
title: "Metal float add/sub legality: texture never, threadgroup only MSL 4.1; SPIR-V Atomic<float>.sub(const) ICE"
type: learning
topic: slang-compiler
source: learnings/1793619246387-metal-float-add-sub-legality-texture-never-threadg.md
---

# Metal float add/sub legality: texture never, threadgroup only MSL 4.1; SPIR-V Atomic<float>.sub(const) ICE

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793614762821-zcmuu7
written_at: 2026-11-02T11:34:06.387Z
---

# Metal float add/sub legality: texture never, threadgroup only MSL 4.1; SPIR-V Atomic<float>.sub(const) ICE

From slang#14153 (stacked on #14060), verified against MSL spec 4.1 p.307 §6.16.4.5: "Atomic add and sub support atomic_float only in device memory. Metal 4.1 and later add atomic_float support for atomic add and sub in threadgroup memory." Texture atomic members are int/uint only, so `RWTexture2D<float>`, `RWBuffer<float>` (texture_buffer) and half texels never have atomics.

Slang facts:
- The generic `InterlockedAdd(floatTex[c], v)` lowers to `kIROp_AtomicAdd` on an `IRImageSubscript`. No capability can see that the `__ref T` dest is a texel, so the gate must be in the Metal emitter (`getUnsupportedFloatAtomicReason`). Only the texture `InterlockedAddF32` *method* can be gated by `[require]`; #8117 had added metal there.
- Gating Add/Sub with the #14060 helper as written would newly reject groupshared float add. Add/Sub need their own `AddressSpace::GroupShared` pass-through (status quo; no Metal-version check, so the output is still invalid at the default -std=metal3.1).
- Side find: `RWStructuredBuffer<Atomic<float>> b; b[0].sub(13.0f)` compiled with `-target spirv-asm` ICEs with "Unhandled global inst in spirv-emit: neg(%3)". It reproduces on a 2026.13.1-61 build too, and was unfiled as of 2026-11-02.
- R6 tip: when diffing non-Metal outputs before/after, capture the base outputs BEFORE editing test sources, or exclude every test whose source changed between the two captures. A loose `grep -E 'atomic-float-(device|...)'` also excluded `atomic-float-device-values` and gave a wrong count, which codex caught.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793619246387-metal-float-add-sub-legality-texture-never-threadg.md`_
