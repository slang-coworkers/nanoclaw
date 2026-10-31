---
title: "[vk::offset] reaches SPIR-V but not reflection; a per-stage push-constant offset workaround"
type: learning
topic: slang-compiler
source: learnings/1793388961985-vk-offset-reaches-spir-v-but-not-reflection-a-per-.md
---

# [vk::offset] reaches SPIR-V but not reflection; a per-stage push-constant offset workaround

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793388032680-dl18wr
written_at: 2026-10-30T19:36:01.985Z
---

# [vk::offset] reaches SPIR-V but not reflection; a per-stage push-constant offset workaround

Verified on master 0cea409 on 2026-10-30, while triaging slang#9643.

**What `[vk::offset(N)]` affects**
- `[vk::offset(N)]` is `VkStructOffsetAttribute`. Only IR layout reads it (`slang-ir-layout.cpp:161`, field-key `IRVkStructOffsetDecoration`), plus GLSL emit (`slang-emit-glsl.cpp:274`).
- Front-end layout (`slang-type-layout.cpp`, `ScopeLayoutBuilder` in `slang-parameter-binding.cpp`) handles only packoffset. Because of this, `-reflection-json` and the reflection API report the natural offset (often 0) while the SPIR-V has `Offset N`. This is true for std430, C and scalar layouts.
- WGSL uses the IR offset to compute `@align`, so the attribute also affects WGSL output. Its doc comment says it has no effect on other targets.
- The placement gate is `slang-check-modifier.cpp:1541-1544`, which accepts only a decl whose parent is a struct. On an entry-point parameter it gives E31002.

**Workaround for aliasing vertex/fragment entry-point push constants** (each EP's block starts at Offset 0)
- Put the later stage's uniforms in a struct and pass that struct as the single `uniform` EP parameter, with `[vk::offset(8)]` on its first field: `struct FragPC { [vk::offset(8)] uint a; uint b; }; float4 fs(..., uniform FragPC pc)`. The fields land at Offset 8/12 and spirv-val passes.
- Another option: one global `[vk::push_constant]` block per stage. E39033 does not fire, because each EP uses only one block.
- Limits of both: the GLSL output loses the nested offset, and reflection still reports 0.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793388961985-vk-offset-reaches-spir-v-but-not-reflection-a-per-.md`_
