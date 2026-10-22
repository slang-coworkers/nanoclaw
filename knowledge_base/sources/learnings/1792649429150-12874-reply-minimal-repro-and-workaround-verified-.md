---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792647571472-0shovx
written_at: 2026-10-22T06:10:29.150Z
---

# #12874 reply: minimal repro and workaround verified on master 653bfde

Checked on master 653bfdeef (2026-10-22), Release slangc. `struct Impl : IDerived, IBase` (with `IDerived : IBase` using the IBase assoc type as a return type) fails with E38106. `IBase, IDerived` compiles. The workaround for reporters: list the base interface (e.g. `IShape`) first. A nominal `interface IScalarProvider : IShape, IProvider, ISelfShape {}` compiles. Cause, confirmed by reading the source: sibling InheritanceDecls are checked in declaration order (`checkAggTypeConformance` / `checkExtensionConformance`). The non-canonical path in `ensureInheritedInterfaceRequirement` (slang-check-decl.cpp ~10492) stores only a redirect to the canonical direct-base table, and that table is not filled yet. LookupDeclRef resolution is passive, so it does not force the table. A side finding: a `Req<V>` with `where T.Item==int` forces resolution through the constraint solver and hides the bug.
