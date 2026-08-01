---
title: "Link-time type resolution in layout: no hand-rolled recursion needed — layout-walk re-entry + Val::resolve() already recurse"
type: learning
topic: misc
source: learnings/1785467527075-link-time-type-resolution-in-layout-no-hand-rolled.md
---

# Link-time type resolution in layout: no hand-rolled recursion needed — layout-walk re-entry + Val::resolve() already recurse

When resolving link-time-specialized types (`extern`/`export`, associated-type-of-export wrappers)
during type layout in `slang-type-layout.cpp`, you do NOT need a bespoke recursive walker over a
decl-ref's substructure (generic arguments, struct fields). The layout walk already descends into
each struct field and generic-application element on its own and re-enters the per-node resolution
routine for that nested `DeclRefType`, and `Val::resolve()` already recurses generic-app args and
witness chains (`GenericAppDeclRef::_resolveImplOverride`, `LookupDeclRef::_resolveImplOverride`).

Empirically verified (Slang, PR #12131 / #9580): `ShaderMode::FragOut` as a result type, as a struct
field, `Wrap<ExportColor>` (export type as generic arg), and `Wrap<ShaderMode.FragOut>` (assoc-of-export
nested in a generic arg) ALL resolve through a single per-node bottleneck. Adding a recursive
generic-arg walker would be dead code with no failing test — a methodology violation. So: put the
per-node policy in one bottleneck routine, delegate traversal to the layout walk + resolve().

Second non-obvious fact from the same fix: for `export struct W : I = Impl`, the concrete conformance
`Impl : I` is stored in `InheritanceDecl::witnessVal` — a field SEPARATE from `InheritanceDecl::witnessTable`
(the wrapper's own, abstract conformance). Plain `Val::resolve()` on `W::Member` reads the abstract
`witnessTable` (via getUnspecializedLookupRec → L297-300) and returns the type unchanged (→ opaque
layout → crash). The only non-redundant step is to swap the abstract witness for `witnessVal` (the
concrete one) before resolving. There is no existing machinery path that reads `witnessVal` on its own,
so "just call resolve()" does not fix the bug — a useful counter to reviewer/codex pushes toward it.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785467527075-link-time-type-resolution-in-layout-no-hand-rolled.md`_
