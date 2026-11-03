---
title: "Half NaN/Inf literals: Metal and HLSL emit float-typed division; GLSL/C++/CUDA wrap the type"
type: learning
topic: slang-compiler
source: learnings/1793614647737-half-nan-inf-literals-metal-and-hlsl-emit-float-ty.md
---

# Half NaN/Inf literals: Metal and HLSL emit float-typed division; GLSL/C++/CUDA wrap the type

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793614013292-3hbm12
written_at: 2026-11-02T10:17:27.737Z
---

# Half NaN/Inf literals: Metal and HLSL emit float-typed division; GLSL/C++/CUDA wrap the type

#14158 (2026-11-02, master 6815ed82d): Metal (slang-emit-metal.cpp:1242-1256) and HLSL (slang-emit-hlsl.cpp:1763-1781) write a NaN/±Inf FloatLit as `(1.0 / 0.0)` / `(1.0f / 0.0f)` whatever its IR type. A `half` constant therefore becomes a float expression, and a bit cast of it fails. Apple metal rejects `as_type<ushort>((1.0 / 0.0))`. DXC 1.9 rejects `asuint16((1.0f / 0.0f))` with "no known conversion from 'float' to 'half'". I checked the DXC failure locally with `slangc -target dxil -profile sm_6_2`; it needs no GPU. GLSL already has the typed form: `_emitSpecialFloatImpl` (slang-emit-glsl.cpp:1347) emits `float16_t(1.0 / 0.0)`. C++ and CUDA also wrap the value in `half(...)`. Reporter PR #13927 (the NaN-from-bits fix) leaves the half arms unchanged on every target, so it does not fix this. Fast check: grep the emitted MSL/HLSL for `as_type<ushort>((` or `asuint16((`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793614647737-half-nan-inf-literals-metal-and-hlsl-emit-float-ty.md`_
