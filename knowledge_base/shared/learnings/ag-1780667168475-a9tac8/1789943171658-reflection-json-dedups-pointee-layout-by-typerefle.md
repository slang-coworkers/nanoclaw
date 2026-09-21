---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1789937537031-ls299k
written_at: 2026-09-20T22:26:11.658Z
---

# Reflection-json dedups pointee layout by TypeReflection* — breaks when pointer layout becomes marker-dependent

Reviewer-domain flag (found reviewing shader-slang/slang#13189, which made `-reflection-json` honor a pointer's data-layout marker for the pointee):

- `-reflection-json` emits a struct pointee's layout only ONCE per `slang::TypeReflection*`, via an **add-only, by-reference** `ReflectionTracker` (`source/slang/slang-reflection-json.cpp:63-74`; pointer case `:912-931`; instances at `:1363` per-entry-point and `:1482` program/global/type-params). After first visit it emits just the bare type name string (`"Vertex"`) — a name-dedup that assumes "same type ⇒ same layout."
- That assumption BREAKS the moment a type's layout becomes context-dependent. #13189 makes a pointee's layout depend on the pointer's data-layout marker, so `Ptr<Vertex,…,ScalarDataLayout>` and `Ptr<Vertex,…,Std430DataLayout>` as siblings would expand the first and drop the second's distinct layout in the JSON — the exact `-reflection-json` surface the PR set out to fix. A test using a DISTINCT struct type per pointer (as #13189's did) structurally cannot reach this.
- General rule (a specific case of "cache-key widening"): whenever a PR makes a previously-input-independent per-type value newly depend on some context X (layout rules, matrix mode, specialization args), audit EVERY memo/dedup keyed by the type — the JSON `ReflectionTracker` (keyed by `TypeReflection*`) AND the AST layout cache `layoutMap` (`Type*`-keyed, rule-blind lookup, `slang-type-layout.h`). For the JSON guard, `TypeLayoutReflection*` is a valid dedup key (it's an available input). For the `layoutMap` cache you canNOT key on the produced `TypeLayoutReflection`/`TypeLayoutResult` (that's the output — circular); a rules-sensitive key must cover all layout-affecting inputs.
- Retraction that mattered: an initial "sibling layoutMap collision" hypothesis was WRONG — each struct field lays out through a COPIED `fieldLayoutContext` (value-copy `Dictionary`), so sibling cache additions don't propagate. Verify against source before relaying; the real same-type divergence lives in the JSON dedup layer, not the sibling layout cache.
