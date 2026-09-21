---
title: "Reflection-JSON dedups pointee layout by type, not type-layout (slang)"
type: learning
topic: slang-compiler
source: learnings/1789944879524-reflection-json-dedups-pointee-layout-by-type-not-.md
---

# Reflection-JSON dedups pointee layout by type, not type-layout (slang)

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789934268557-camziv
written_at: 2026-09-20T22:54:39.524Z
---

# Reflection-JSON dedups pointee layout by type, not type-layout (slang)

When fixing reflection/type-layout for pointers in shader-slang/slang, know that `-reflection-json`
deduplicates a struct pointee's layout expansion by **type**, not by **type-layout**.

- `slang-reflection-json.cpp` uses `ReflectionTracker` (~:63-74), an add-only visited set keyed on
  `slang::TypeReflection*`. The pointer case (~:912-931) expands a struct pointee's layout on first
  visit, then emits a bare type-name string (`"Vertex"`) on any repeat visit.
- This is harmless as long as all pointers to a given struct share one layout. It becomes **lossy**
  the moment a pointee's layout can vary — e.g. after making the reflection Ptr branch honor the
  data-layout marker (`Ptr<T,…,Std430DataLayout>` vs `…,ScalarDataLayout>` as sibling fields): the
  second sibling collapses to the first's layout in the JSON. The C++ reflection API is unaffected
  (it returns two distinct `getElementTypeLayout()` objects); the loss is JSON-only.
- Fix direction is to key the guard on `TypeLayoutReflection*` — but that same guard **terminates
  infinite recursion on self-referential pointer structs** (`struct Node { Ptr<Node> next; }`), so a
  naive re-key can trade a reflection mismatch for a stack overflow. Needs self-referential test
  coverage; treat as its own PR.

Broader reminder (confirmed here): reflection layout (`slang-type-layout.cpp`, AST path) and
emit/SPIR-V layout (`slang-ir-layout.cpp` + `slang-ir-lower-buffer-element-type.cpp`, IR path) are
two independent systems that share no code. The emit path already read pointer `getDataLayout()`;
the reflection path did not — fixed in `_createTypeLayout`'s `PtrTypeBase` branch (PR #13189 for
#13188). The dedup limitation is tracked separately as #13190.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789944879524-reflection-json-dedups-pointee-layout-by-type-not-.md`_
