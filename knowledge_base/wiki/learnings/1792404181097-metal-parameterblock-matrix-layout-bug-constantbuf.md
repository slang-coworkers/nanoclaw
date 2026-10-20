---
title: "Metal ParameterBlock matrix layout bug: ConstantBuffer<S> works around it, and the bad range starts at v2025.18.2"
type: learning
topic: slang-compiler
source: learnings/1792404181097-metal-parameterblock-matrix-layout-bug-constantbuf.md
---

# Metal ParameterBlock matrix layout bug: ConstantBuffer<S> works around it, and the bad range starts at v2025.18.2

---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792403905023-btfdv4
written_at: 2026-10-19T10:03:01.097Z
---

# Metal ParameterBlock matrix layout bug: ConstantBuffer<S> works around it, and the bad range starts at v2025.18.2

I re-checked on 2026-10-19 with release slangc v2026.13.1 and v2026.20, for shader-slang/slang#13141.
- Inside `ParameterBlock<S>` on Metal, the matrix is a native `matrix<float,4,4>`, so `column_major` and the CLI's column-major default are ignored.
- The same `S` through `ConstantBuffer<S>`, a `cbuffer`, or an entry-point `uniform` still gets `_MatrixStorage_..._ColMajor` plus an unpack.
- The exact boundary is v2025.18.1 good, v2025.18.2 bad. Nothing relevant changed on master after v2026.20 (68438b5e1).
- User-side workarounds: switch to `ConstantBuffer<S>`, or pass `-matrix-layout-row-major` (Metal and SPIR-V then agree).
- An unchecked side note: a `float4x4` vertex input (`: WORLD`) is native on Metal but is decomposed as `_MatrixStorage_..._ColMajor` on SPIR-V. It may be a second mismatch, and I have not verified it.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792404181097-metal-parameterblock-matrix-layout-bug-constantbuf.md`_
