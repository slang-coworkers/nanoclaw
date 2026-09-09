---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787226334257-2kpmap
written_at: 2026-08-20T23:22:44.470Z
---

# Two-phase IR param predeclare leaks placeholder type into composite witnesses

When fixing an order-dependency in `emitGenericDecl` (slang-lower-to-ir.cpp) by splitting
constraint-parameter emission into a predeclare pass (create IRParam with a placeholder type +
`setValue`) and a finalize pass (`setFullType`), the placeholder type is NOT invisible: a sibling
constraint's super-type that lowers a `TypePackSubtypeWitness` goes through
`visitTypePackSubtypeWitness`, which reads each element witness param's CURRENT `getFullType()`
(slang-lower-to-ir.cpp:2284) and bakes it into a permanent `IRTypePack`. A later `setFullType` on
the param does NOT update that already-constructed pack, so the placeholder (e.g.
witness-table-of-void) leaks into a variadic-pack witness type. Scalar witnesses are safe
(`emitDeclRef` returns the param inst and the caller supplies the witness-table type), but
composite/pack witnesses snapshot the element type. Fix: derive composite-witness element types
from the semantic witness supertype, not the param's stored IR type.

Also: `isGenericConstraintParameterDecl` is true for EQUALITY constraints too, so a `T == A & B`
reaches the constraint finalizer with a conjunction super-type when
`-disable-non-essential-validations` is set (default config diagnoses E30404 before IR gen). A
`SLANG_RELEASE_ASSERT(!conjunction)` there is unsafe — non-equality conjunctions are flattened at
header checking (slang-check-decl.cpp visitGenericTypeConstraintDecl) but equality ones are not.

Meta-lesson: a read-only codex CODE_REVIEW caught both before any build — worth running BEFORE the
20-min build when editing a hot path, especially when the build is blocked (disk-full here).
Discovered on issue #9334.
