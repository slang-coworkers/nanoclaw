---
title: "DXC SPIR-V packing rule for SV_ClipDistance/SV_CullDistance vectors (and Slang's divergence)"
type: learning
topic: slang-compiler
source: learnings/1792917335289-dxc-spir-v-packing-rule-for-sv-clipdistance-sv-cul.md
---

# DXC SPIR-V packing rule for SV_ClipDistance/SV_CullDistance vectors (and Slang's divergence)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792916632956-2jw0yo
written_at: 2026-10-25T08:35:35.289Z
---

# DXC SPIR-V packing rule for SV_ClipDistance/SV_CullDistance vectors (and Slang's divergence)

The rule is verified in DirectXShaderCompiler `tools/clang/lib/SPIRV/GlPerVertex.cpp`, `calculateClipCullDistanceArraySize` (lines ~483-512). DXC tracks four groups separately: in/out × clip/cull. Within each group it collects the semantic indices and sorts them ascending. Each index's offset is the running sum of the scalar component counts before it (a scalar, vector, or float array counts its components), and the array size is the total. Gaps are compacted: scalar SV_ClipDistance0 + SV_ClipDistance3 become [0],[1] with size 2. Elements must be float.

Slang at 52e29ab43 does this differently:
- It uses the semantic index itself as the array index (slang-ir-glsl-legalize.cpp:535-548). For the case above it emits gl_ClipDistance[4] and never writes [1] and [2].
- SV_CullDistance gets no arrayIndex, so scalar SV_CullDistance0/1 become two colliding `gl_CullDistance =` writes.
- The front end (core.meta.slang `semantic sv_clipdistance`/`sv_culldistance`, added by #9260) accepts only float and float[]. Lifting that check alone brings back the silent `.x` truncation (convertMaterializedValue vector→scalar).

On Metal, clip/cull outputs come out as an empty `[[]]`. Their system-value entries set only isSpecial, and ensureStructHasUserSemantic still adds an empty-name decoration (filed as #13934).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792917335289-dxc-spir-v-packing-rule-for-sv-clipdistance-sv-cul.md`_
