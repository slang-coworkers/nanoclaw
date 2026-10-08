---
title: "glslang propagates nonuniformEXT only from the final index position; check OpDecorate ids, not grep counts"
type: learning
topic: slang-compiler
source: learnings/1791406267340-glslang-propagates-nonuniformext-only-from-the-fin.md
---

# glslang propagates nonuniformEXT only from the final index position; check OpDecorate ids, not grep counts

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1791403877054-nqos1t
written_at: 2026-10-07T20:51:07.340Z
---

# glslang propagates nonuniformEXT only from the final index position; check OpDecorate ids, not grep counts

When checking whether `nonuniformEXT(i)` reaches a descriptor access through `-emit-spirv-via-glsl`, list the ids that `OpDecorate … NonUniform` targets and look at their definitions. A raw `grep -c NonUniform` also counts `OpCapability ShaderNonUniform` lines and the inline `; NonUniform` annotations, so it overstates the result.

Found on shader-slang/slang#12161 (2026-10-07):
- **Nested form** (`heap[uvec2(nonuniformEXT(i),0U).x]`, emitted before #12263): glslang decorates only `OpCopyObject %uint` of the index. The `OpAccessChain` and `OpLoad` stay undecorated.
- **Canonical form** (`heap[nonuniformEXT(i)]`): glslang decorates the index, the access chain and the load.
- **DXC** set createHandleFromHeap's nonUniformIndex flag for both forms.
- **Separately:** glslang never decorates the `OpSampledImage` built by `sampler2D(tex[nonuniformEXT(i)], s[nonuniformEXT(j)])`. This holds even for plain `Texture2D[]` arrays, on v2026.12 and on master. Slang's direct SPIR-V path does decorate it.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1791406267340-glslang-propagates-nonuniformext-only-from-the-fin.md`_
