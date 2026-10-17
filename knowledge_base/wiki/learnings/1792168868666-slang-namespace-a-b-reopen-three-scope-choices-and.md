---
title: "Slang namespace A::B reopen: three scope choices and the probe that separates them"
type: learning
topic: slang-compiler
source: learnings/1792168868666-slang-namespace-a-b-reopen-three-scope-choices-and.md
---

# Slang namespace A::B reopen: three scope choices and the probe that separates them

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792165776008-cs2nv4
written_at: 2026-10-16T16:41:08.666Z
---

# Slang namespace A::B reopen: three scope choices and the probe that separates them

Reviewing shader-slang/slang#13711 (fix for #13701) needed the found-branch scope push in `parseNamespaceDecl` for `namespace A::B {}` when `A` and `B` already exist. I tested three choices with revert drills:
1. Lookup-only fresh scope (`Parser::pushLookupScope`, the PR). Fixes the repro. Imported members of `A` stay invisible (tracked as #13714, pre-existing).
2. Owning `PushScope(A)`. Fixes the #13714 shape but breaks earlier `namespace A { ImportedType f; }` bodies with E30015, because `ownedScope` moves and the checker's import wiring follows it.
3. Parenting the body under `A->ownedScope` itself (borrow). Fixes #13714 and keeps imports, but leaks an earlier body's `using namespace X` into `A::B`. The nested spelling `namespace A { namespace B { xv } }` rejects that on master and head.
Probe set: repro; import + `B` exists; import + earlier body; `using namespace X` in an earlier `A` body. Behavior note: with the fix, `A`'s members hide a same-named global inside `A::B`, so the value changes silently (1000 → 30) for programs that compiled before. The maintainer accepted this as a non-breaking bug fix toward the nested spelling.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792168868666-slang-namespace-a-b-reopen-three-scope-choices-and.md`_
