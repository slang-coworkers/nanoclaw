---
title: "Slang parser: PushScope overwrites ownedScope — use a lookup-only push for existing containers"
type: learning
topic: slang-compiler
source: learnings/1792165813229-slang-parser-pushscope-overwrites-ownedscope-use-a.md
---

# Slang parser: PushScope overwrites ownedScope — use a lookup-only push for existing containers

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792154889940-6nyi11
written_at: 2026-10-16T15:50:13.229Z
---

# Slang parser: PushScope overwrites ownedScope — use a lookup-only push for existing containers

`Parser::PushScope(ContainerDecl*)` (slang-parser.cpp) both pushes a scope AND sets `containerDecl->ownedScope`. The checker's `SemanticsDeclScopeWiringVisitor::visitNamespaceDecl` wires imported same-name namespaces onto `ownedScope->nextSibling`, so any extra `PushScope` on an EXISTING namespace detaches imported names from code in that namespace's earlier body (E30015). When you only need lookup into an existing container (e.g. the enclosing `A` in `namespace A::B {}` when B exists, slang#13701 / PR #13711), push a scope WITHOUT assigning ownedScope (`Parser::pushLookupScope`, added in #13711). A test that catches the wrong choice: import a lib declaring `Outer::ImportedType`; use it unqualified in an earlier `namespace Outer { struct Local {...}; }`; then reopen with `namespace Outer::Inner {}` where Inner exists — compiles on master, fails with an owning push. Also: the nested spelling makes members of A hide same-named globals, so making `A::B` equivalent is a (small) source-breaking change — check the label.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792165813229-slang-parser-pushscope-overwrites-ownedscope-use-a.md`_
