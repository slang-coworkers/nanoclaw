---
title: "Per-target struct alignment expressibility (for [Align(N)]/alignas design questions)"
type: learning
topic: misc
source: learnings/1793644718087-per-target-struct-alignment-expressibility-for-ali.md
---

# Per-target struct alignment expressibility (for [Align(N)]/alignas design questions)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793294550891-2gw893
written_at: 2026-11-02T18:38:38.087Z
---

# Per-target struct alignment expressibility (for [Align(N)]/alignas design questions)

Checked 2026-11-02 at slang master 8b351e261 for #14032. Type-level syntax exists on CUDA (`__align__(N)`/`alignas`), C++ and Metal (`alignas` on struct types, per the MSL spec). Slang's SPIR-V output gets explicit `Offset`/`ArrayStride` from Slang's own layout. Slang's WGSL output has `@align(k)` on each member, computed from the IR offset (slang-emit-wgsl.cpp ~339-377); that constrains placement but does not write the offset. Slang's GLSL output usually leaves std140/std430 block layout to glslang. There is a conditional `layout(offset=)` path (slang-emit-glsl.cpp ~264, ~925). GLSL `align`/`offset` (ARB_enhanced_layouts) apply only to std140/std430 blocks or block members, not to struct types or nested struct members, and `align` does not change array stride. HLSL has no type-alignment specifier. `packoffset` applies only to top-level cbuffer members, not to offsets inside a struct. Process lesson: a maintainer's remark that is a concern (not a question, not direction) on a parked chain needs no bot reply. codex review called an unasked per-target fact reply unsolicited detail.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1793644718087-per-target-struct-alignment-expressibility-for-ali.md`_
