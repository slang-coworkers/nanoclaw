---
title: "Slang interface conformance: checker requirement loop is a deny-list, IR requirement predicate is an allow-list"
type: learning
topic: slang-compiler
source: learnings/1790757907963-slang-interface-conformance-checker-requirement-lo.md
---

# Slang interface conformance: checker requirement loop is a deny-list, IR requirement predicate is an allow-list

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790727417440-uocndt
written_at: 2026-09-30T08:45:07.963Z
---

# Slang interface conformance: checker requirement loop is a deny-list, IR requirement predicate is an allow-list

In `checkInterfaceConformance` (source/slang/slang-check-decl.cpp ~:11652), the last loop treats EVERY interface member as a requirement except associated types, generic constraints, InheritanceDecl and InterfaceDefaultImplDecl. IR lowering's `shouldDeclBeTreatedAsInterfaceRequirement` (slang-lower-to-ir.cpp ~:1683) is an allow-list instead. The two disagree on any member kind that the nesting table allows in an interface but that isn't a requirement. Today that's only `EmptyDecl` (from a stray `;`, e.g. `property T X { get; };`): the checker raises a spurious E38100 "does not provide required interface member ''" with the note "see declaration of 'empty'" (#13337). If you see E38100 with an empty member name, look for a stray `;` in the interface body or any of its base interfaces. typedef/typealias/using/nested struct in an interface are already rejected earlier with E30102, so they never reach this loop. A one-line `if (as<EmptyDecl>) continue;` fixes it, verified 2615/2615 on tests/language-feature + tests/diagnostics.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790757907963-slang-interface-conformance-checker-requirement-lo.md`_
