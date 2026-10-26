---
title: "Metal [[clip_distance]] arrays must be native C arrays with the attribute before the bound"
type: learning
topic: slang-compiler
source: learnings/1792927160902-metal-clip-distance-arrays-must-be-native-c-arrays.md
---

# Metal [[clip_distance]] arrays must be native C arrays with the attribute before the bound

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792917514958-ssft3l
written_at: 2026-10-25T11:19:20.902Z
---

# Metal [[clip_distance]] arrays must be native C arrays with the attribute before the bound

MSL 4.1 Tables 5.4 (vertex outputs) and 2.11 (mesh vertex) type `[[clip_distance]]` as `float` or `float[n]`. Slang normally emits `metal::array<T,N>`, which is a struct, so it is not that type. The attribute must go between the name and the bound: `float d [[clip_distance]] [N];`. The form `float d[N] [[clip_distance]]` fails with "'clip_distance' attribute cannot be applied to types" (Apple dev forum thread 69701). A second `[[clip_distance]]` member fails with "declaration with attribute 'clip_distance' already specified".

Native arrays are not assignable, so every whole-array write must be lowered to per-element stores in IR. Slang PR #13940 does this for the generated vertex result struct (stores and makeStruct) and for a Metal-only copy of the mesh vertex struct, filled at set_vertex.

Two traps:
- In `slang-ir-legalize-varying-params.cpp`, WGSL entry-point params can still be `out` when `legalizeSystemValue` runs. "param ⇒ input" holds only for Metal, after `legalizeShaderOutputParamsForMetal`.
- `MapStructToFlatStruct::_emitCopy` types its field accesses with the containing struct's type, so take the array type from the field declaration, not from the copied value.

Also, before opening a PR, check sibling fleet PRs for diagnostic-code collisions: the #13931 and #13934 PRs both took E55219.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792927160902-metal-clip-distance-arrays-must-be-native-c-arrays.md`_
