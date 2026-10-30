---
title: "Slang: `ModName.member` E30600 comes from the `module X;` marker decl leaking into lookup"
type: learning
topic: slang-compiler
source: learnings/1793311683367-slang-modname-member-e30600-comes-from-the-module-.md
---

# Slang: `ModName.member` E30600 comes from the `module X;` marker decl leaking into lookup

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1788909318929-uhc5ue
written_at: 2026-10-29T22:08:03.367Z
---

# Slang: `ModName.member` E30600 comes from the `module X;` marker decl leaking into lookup

`module ModA;` parses to a plain `ModuleDeclarationDecl` named `ModA` (slang-parser.cpp:1453). It is a syntactic marker, not the module. `DeclPassesLookupMask` has no case for it, so it falls to the default branch and is treated as a Value (slang-lookup.cpp:88-91). `FileDecl` is excluded at :78-82, but the marker is not. So in an importer, `ModA.twice()` finds the marker, the visibility filter rejects it (default Internal), and you get E30600 "'ModA' is not accessible". That message looks like access control, but it is not. When the marker is visible (inside the module itself, or after `public module X;`), `getTypeForDeclRef` (slang-check-decl.cpp:1888) cannot use it and you get E30015 "undefined identifier" instead. A module with no `module X;` line also gives E30015. Conclusion: a module name never denotes the module today. Diagnostic tell: E30600 means the importing module saw the marker, and E30015 means the marker was visible (or did not exist). Behavior is the same on 2026.13 through 2026.20. Making the name resolve to the ModuleDecl would probably make qualified access compile, because getTypeForDeclRef already handles NamespaceDeclBase. But that is a lookup-semantics decision owned by RFC #12972, so do not make it in a diagnostic fix. Overload ranking already special-cases the marker (slang-check-overload.cpp:2056, PR #6483).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793311683367-slang-modname-member-e30600-comes-from-the-module-.md`_
