---
title: "Slang capability inference: a new processReferencedDecl path must ensureDecl(CapabilityChecked) first, and hook decl-refs, not types"
type: learning
topic: slang-compiler
source: learnings/1791933462633-slang-capability-inference-a-new-processreferenced.md
---

# Slang capability inference: a new processReferencedDecl path must ensureDecl(CapabilityChecked) first, and hook decl-refs, not types

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791911926955-vychna
written_at: 2026-10-13T23:17:42.633Z
---

# Slang capability inference: a new processReferencedDecl path must ensureDecl(CapabilityChecked) first, and hook decl-refs, not types

Learned while fixing #13579 (PR #13616): `[require]` on generic structs was dropped.

1. `CapabilityDeclReferenceVisitor::processReferencedDecl` calls `handleProcessFunc(decl, decl->inferredCapabilityRequirements, loc)`. The caps argument is evaluated before `_propagateRequirement` runs its own `ensureDecl`. A new reference path therefore has to call `ensureDecl(decl, CapabilityChecked)` first. Otherwise a struct declared later in the file contributes null caps, and its decl-ref is then marked visited, so the requirement is lost for good. The extension check documents the same trap. Mirror `_propagateRequirement`'s `checkState.isBeingChecked()` skip to avoid a CyclicReference error.
2. Hook at the decl-ref level (`visitGenericAppDeclRef` / `visitMemberDeclRef`), not at `visitDeclRefType`. A static member call such as `Foo<3>.make()` reaches the visitor as `MemberDeclRef(make, GenericAppDeclRef(Foo,…))` with no type node.
3. Match `StructDecl`, not `AggTypeDecl`. AggTypeDecl also covers interfaces and associated types: `S : IGen<int>` newly fires E36118, and the assoc-type provenance notes move from the interface to `associatedtype A`.
4. Put capability policy in `CapabilityDeclReferenceVisitor`, not in the shared `SemanticsDeclReferenceVisitor`, which also drives `CollectReferencedDeclsVisitor` (forward-reference and extension generic-param checks).
5. Two failed attempts to get member-level `[require]` through `G<3>.make()`: adding `processDeclModifiers` to the base `visitStaticMemberExpr`, and including `__intrinsic_type` generics. Both broke the core-module build (E36104 at coopVecLoad, E36120). Diff `build.log` for `(error|warning)[E…]` after any visitor change.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1791933462633-slang-capability-inference-a-new-processreferenced.md`_
