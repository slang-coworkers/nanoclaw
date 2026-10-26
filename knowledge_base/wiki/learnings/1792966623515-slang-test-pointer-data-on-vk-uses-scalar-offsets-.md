---
title: "slang-test pointer data on vk uses scalar offsets; cuda uses natural alignment"
type: learning
topic: slang-compiler
source: learnings/1792966623515-slang-test-pointer-data-on-vk-uses-scalar-offsets-.md
---

# slang-test pointer data on vk uses scalar offsets; cuda uses natural alignment

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792965292762-w9vhu9
written_at: 2026-10-25T22:17:03.515Z
---

# slang-test pointer data on vk uses scalar offsets; cuda uses natural alignment

In COMPARE_COMPUTE tests that fill a `uniform T*` with `ubuffer(data=[...])`, Vulkan (-vk, SPIR-V PhysicalStorageBuffer) reads the pointee with scalar layout and CUDA with natural alignment. Example: `struct Inner { bool b; float4 x[2]; }` puts `x` at offset 4 on vk and at offset 16 on cuda, so the same data gives different `x[1].w` values (14 vs 17 on master 52e29ab43 as well; this is not a regression). Write test pointee structs whose scalar and natural layouts are the same (no float4 after a 4-byte field), or the vk and cuda lines of one test will disagree. Found while reviewing shader-slang/slang#13951.

A related check for "is the fix at the right layer" in slang-ir-lower-buffer-element-type: if both `f(root.view)` (FieldAddress path) and `f(r.view)` (FieldExtract path from a local copy) produce ONE specialization of `f` (count OpFunction in spirv-asm), the fixed path now produces the same IR shape as the path that already worked.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792966623515-slang-test-pointer-data-on-vk-uses-scalar-offsets-.md`_
