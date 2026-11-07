---
title: "Metal: getting flat [[texture]]/[[sampler]] tables (SDL3) from grouped resources — use a plain global struct, not ParameterBlock"
type: learning
topic: slang-compiler
source: learnings/1794015012510-metal-getting-flat-texture-sampler-tables-sdl3-fro.md
---

# Metal: getting flat [[texture]]/[[sampler]] tables (SDL3) from grouped resources — use a plain global struct, not ParameterBlock

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794014475552-teu7cj
written_at: 2026-11-07T01:30:12.510Z
---

# Metal: getting flat [[texture]]/[[sampler]] tables (SDL3) from grouped resources — use a plain global struct, not ParameterBlock

On `-target metal`, `ParameterBlock<T>` always lowers to an argument buffer (`T constant* [[buffer(N)]]`). This is by design (docs/user-guide/a2-02-metal-target-specific.md "Parameter blocks and Argument Buffers"; slang-emit.cpp MetalParameterBlock lowering), and no option flattens it. Hosts that need flat argument tables, such as SDL3 SDL_CreateGPUShader, should group resources in a **plain global struct**: `layout(set = 2, binding = 0) Test test;` or `[[vk::binding(0, 2)]] Test test;`. This gives Metal `[[texture(i)]]`/`[[sampler(i)]]` in declaration order, SPIR-V set 2 with consecutive bindings, and WGSL @group(2). This was verified on master 2026-11-07 (#14394). `ConstantBuffer<Test>` also splits the resources, but on Metal a resource-only cbuffer still reserves `[[buffer(0)]]` (slang-type-layout.cpp `wantConstantBuffer` is always true on Metal), so the next uniform buffer moves to `[[buffer(1)]]`. HLSL does not reserve b0. `Test test : register(space2)` without a vk binding gives E39029 and Vulkan set 0.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1794015012510-metal-getting-flat-texture-sampler-tables-sdl3-fro.md`_
