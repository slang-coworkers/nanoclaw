---
title: "slang#10471 module accessibility — maintainer-blessed design; both parts semantic-check-only"
type: learning
topic: slang-compiler
source: learnings/1783523027176-slang-10471-module-accessibility-maintainer-blesse.md
---

# slang#10471 module accessibility — maintainer-blessed design; both parts semantic-check-only

Triage of shader-slang/slang#10471 (ccummingsNV, SlangPy/Falcor extensibility feature request). Two asks, and core architect **csyonghe already commented a concrete blessed design** (issuecomment-4069451326, 2026-03-16) — both are scope-REDUCTIONS from the reporter's original asks, so a triager must endorse the maintainer direction, not re-propose the reporter's:

- **Part 1 (import injection):** reporter wanted a bidirectional `implementing`-style model (generated module injects itself into a target module WITHOUT the target `__include`ing it). Maintainer's simpler direction: a slangpy-only import modifier `__slangpy_trampoline import M;` that makes M's `internal` symbols visible as if declared locally.
- **Part 2 (grouped-public fields):** reporter wanted C++-style `public:` access-sections. Maintainer's direction: change the default rule so members of a `public struct` default to `public`.

Key architectural facts confirmed (@ HEAD bfe6a7f14, via code readers + DeepWiki), reusable for any Slang visibility work:
1. **Visibility has a SINGLE choke point:** `SemanticsVisitor::isDeclVisibleFromScope` (slang-check-expr.cpp:1092-~1120). The `Internal` gate is `getModuleDecl(decl) == getModuleDecl(scope)`. Called from the lookup-result filter (:1224-1233) and overload resolution (slang-check-overload.cpp:275). A trampoline import is just a scope-tagged bypass of THIS predicate (scope it to the importer only — don't weaken lookup for other importers, don't expose Private).
2. **Internal symbols are NOT stripped at IR lowering OR module serialization** — visibility is purely a semantic-check concern. So both parts are semantic-checking-only, zero downstream (lowering/emit/serialize) work.
3. **Per-import modifiers already exist:** `__exported` is a plain `ExportedModifier : Modifier` (slang-ast-modifier.h:142) registered in the parser at ~:11009 and gates the `importModuleIntoScope` re-export recursion — the exact template for a new import modifier.
4. **Member default visibility keys off the MODULE default, not the parent struct:** `getDeclVisibility` (slang-check-decl.cpp:20916, default fall-through :20954-20960) → `DeclVisibility::Default` (=Internal), overridden only by legacy language version or module-level `defaultVisibility`. So `public struct Foo { int a; }` leaves `a` internal unless the whole module is `public` — that's the reporter's exact pain. A stale comment there claims "capped to parent" but only NamespaceDecl + interface members are special-cased; struct is not. E30601 ("visibility higher than parent", slang-check-modifier.cpp:2375) allows EQUAL visibility, so defaulting members to the struct's own visibility is compatible.

Disposition: `Dev Reviewed` + assigned to maintainer jkwak-work + core-architect design + no bot ask → **maintainer-team-owned; PARK at triaged, no fixer auto-dispatch** (same posture as #11568). Verified 5-bullet posted (nv-slang-bot cmt 4916184926). Both parts are engineering-ready if/when a maintainer gives a go.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1783523027176-slang-10471-module-accessibility-maintainer-blesse.md`_
