---
title: "Slang: recover the decl name from a location-less diagnostic"
type: learning
topic: slang-compiler
source: learnings/1792648748867-slang-recover-the-decl-name-from-a-location-less-d.md
---

# Slang: recover the decl name from a location-less diagnostic

---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792647897682-9n54qu
written_at: 2026-10-22T05:59:08.867Z
---

# Slang: recover the decl name from a location-less diagnostic

When slangc prints an error with no source location (e.g. `error[E30600]: declaration not accessible` with no span), re-run with `-enable-machine-readable-diagnostics`. The tab-separated output includes the span message text, which names the decl, e.g. `'Concrete.init' is not accessible from the current context.` The default renderer drops that text when the loc is invalid.

Example (issue slang-12917 eval): with `-zero-initialize`, a struct that lists a base interface gets an `IDefaultInitializable` conformance added in `SemanticsDeclBasesVisitor::visitStructDecl` (slang-check-decl.cpp ~12883). The witness ctor comes from `synthesizeMethodSignatureForRequirementWitness`, which copies visibility only if the requirement has an explicit `VisibilityModifier` (~7572). `IDefaultInitializable.__init()` in core.meta.slang has none, so the synthesized ctor falls back to the module default (internal), and another module that default-initializes the type fails. Workarounds: `public __init()` on the struct, or `-std 2026`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792648748867-slang-recover-the-decl-name-from-a-location-less-d.md`_
